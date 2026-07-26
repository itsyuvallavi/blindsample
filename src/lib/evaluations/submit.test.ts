import { describe, expect, it, vi } from "vitest";

import { CsvSampleError } from "../csv/parse-sample";
import { compileEvaluationContracts } from "../evaluation-contracts/compile";
import type { SellerEvaluationView } from "../supabase/evaluations";
import { ZeroGClientError } from "../zero-g/client";
import {
  SampleSubmissionError,
  submitPrivateSample,
} from "./submit";

const CSV_BYTES = new TextEncoder().encode(
  "order_id,order_date\n1,2026-07-20\n2,2026-07-21",
);
const CONTRACTS = compileEvaluationContracts([
  {
    columns: ["order_id"],
    controls: {
      intermediate: "A record that may refer to an order.",
      negative: "A weather observation unrelated to commerce.",
      positive: "A confirmed customer order identifier.",
    },
    id: "q-orders",
    kind: "semantic_relevance",
    question: "Are these useful order records?",
    target: "Records that represent customer orders.",
  },
]);
const SELLER_VIEW: SellerEvaluationView = {
  approvedAt: "2026-07-26T00:00:00.000Z",
  contracts: CONTRACTS,
  expiresAt: "2099-01-01T00:00:00.000Z",
  id: "evaluation-1",
  status: "waiting_for_seller",
  title: "Orders",
};
const VERIFIED_RESULT = {
  results: [
    {
      evidence: {
        agreement: {
          ratio: 1,
          requiredRatio: 0.8,
          status: "passed",
        },
        contractVersion: "1.0.0",
        controlCheck: "passed",
        coverageRatio: 1,
        limitation:
          "This result describes only the submitted records.",
        measurement: {
          name: "mean_rubric_points",
          unit: "rubric_points",
          value: 75,
        },
        method: "semantic",
        recordsEvaluated: 2,
        recordsSubmitted: 2,
        zeroG: {
          requests: [
            {
              model: "test-model",
              provider: "test-provider",
              requestId: "test-request",
              teeVerified: true,
            },
          ],
          teeVerified: true,
        },
      },
      questionId: "q-orders",
      score: 75,
      status: "scored",
    },
  ],
  semanticVerification: "verified" as const,
};

function dependencies(
  overrides: Partial<Parameters<typeof submitPrivateSample>[1]> = {},
) {
  return {
    beginSubmission: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    getSellerView: vi.fn().mockResolvedValue(SELLER_VIEW),
    parseSample: vi.fn((bytes: Uint8Array) => ({
      columnCount: 2,
      columns: ["order_id", "order_date"],
      rowCount: 2,
      rows: [
        ["1", "2026-07-20"],
        ["2", "2026-07-21"],
      ],
      sourceByteLength: bytes.byteLength,
    })),
    scoreSample: vi.fn().mockResolvedValue(VERIFIED_RESULT),
    ...overrides,
  };
}

describe("submitPrivateSample", () => {
  it("persists only counts, results, and safe aggregate evidence", async () => {
    const deps = dependencies();

    await expect(
      submitPrivateSample(
        {
          bytes: CSV_BYTES,
          evaluationId: "evaluation-1",
          sellerToken: "seller-token",
        },
        deps,
      ),
    ).resolves.toEqual({ status: "complete" });

    expect(deps.beginSubmission).toHaveBeenCalledWith({
      id: "evaluation-1",
      sampleColumnCount: 2,
      sampleRowCount: 2,
      token: "seller-token",
    });
    expect(deps.complete).toHaveBeenCalledWith("evaluation-1", {
      sampleColumnCount: 2,
      sampleRowCount: 2,
      results: VERIFIED_RESULT.results,
    });

    const persistenceCalls = JSON.stringify([
      vi.mocked(deps.beginSubmission).mock.calls,
      vi.mocked(deps.complete).mock.calls,
    ]);
    expect(persistenceCalls).not.toContain("2026-07-20");
    expect(persistenceCalls).not.toContain("order_id,order_date");
  });

  it("does not claim an evaluation when CSV validation fails", async () => {
    const deps = dependencies({
      parseSample: vi.fn(() => {
        throw new CsvSampleError("Malformed sample.", "invalid_csv");
      }),
    });

    await expect(
      submitPrivateSample(
        {
          bytes: CSV_BYTES,
          evaluationId: "evaluation-1",
          sellerToken: "seller-token",
        },
        deps,
      ),
    ).rejects.toThrowError(CsvSampleError);
    expect(deps.beginSubmission).not.toHaveBeenCalled();
    expect(deps.scoreSample).not.toHaveBeenCalled();
  });

  it("does not score when another submission owns the claim", async () => {
    const deps = dependencies({
      beginSubmission: vi.fn().mockResolvedValue(false),
    });

    await expect(
      submitPrivateSample(
        {
          bytes: CSV_BYTES,
          evaluationId: "evaluation-1",
          sellerToken: "seller-token",
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: "already_processing" });
    expect(deps.scoreSample).not.toHaveBeenCalled();
  });

  it.each([
    [
      new ZeroGClientError(
        "TEE verification failed.",
        "unverified_response",
      ),
      "tee_verification_failed",
    ],
    [
      new ZeroGClientError("Router unavailable.", "request_failed", 503),
      "zero_g_unavailable",
    ],
  ])("stores a safe failure code for %s", async (error, errorCode) => {
    const deps = dependencies({
      scoreSample: vi.fn().mockRejectedValue(error),
    });

    await expect(
      submitPrivateSample(
        {
          bytes: CSV_BYTES,
          evaluationId: "evaluation-1",
          sellerToken: "seller-token",
        },
        deps,
      ),
    ).rejects.toThrowError(SampleSubmissionError);
    expect(deps.fail).toHaveBeenCalledWith(
      "evaluation-1",
      errorCode,
    );
    expect(deps.complete).not.toHaveBeenCalled();
  });
});
