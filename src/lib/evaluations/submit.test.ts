import { describe, expect, it, vi } from "vitest";

import { CsvSampleError } from "../csv/parse-sample";
import type { SellerEvaluationView } from "../supabase/evaluations";
import { ZeroGClientError } from "../zero-g/client";
import {
  SampleSubmissionError,
  submitPrivateSample,
} from "./submit";

const CSV_BYTES = new TextEncoder().encode(
  "order_id,order_date\nprivate-order-1,2026-07-20\nprivate-order-2,2026-07-21",
);
const QUESTIONS = [
  {
    id: "q-orders",
    question: "Are these useful order records?",
  },
] as const;
const SELLER_VIEW: SellerEvaluationView = {
  approvedAt: "2026-07-26T00:00:00.000Z",
  expiresAt: "2099-01-01T00:00:00.000Z",
  failure: {
    code: null,
    requestMade: false,
  },
  id: "evaluation-1",
  questions: [...QUESTIONS],
  status: "waiting_for_seller",
  title: "Orders",
};
const INFERENCE_DIAGNOSTICS = {
  requestCount: { made: 1 as const, maximum: 1 as const },
  requests: [
    {
      attempt: 1,
      billing: {
        inputCostNeuron: "10",
        outputCostNeuron: "20",
        totalCostNeuron: "30",
      },
      durationMs: 10,
      finishReason: "stop",
      httpStatus: 200,
      model: "test-model",
      outcome: "succeeded" as const,
      provider: "test-provider",
      reasoningContentPresent: false,
      requestId: "test-request",
      responseLength: 100,
      teeVerified: true,
      usage: {
        completionTokens: 20,
        promptTokens: 10,
        reasoningTokens: 0,
        totalTokens: 30,
      },
    },
  ],
};
const VERIFIED_RESULT = {
  diagnostics: INFERENCE_DIAGNOSTICS,
  inferenceRequests: { made: 1 as const, maximum: 1 as const },
  results: [
    {
      confidence: 90,
      denominator: 2,
      evaluationBasis: {
        description: "Submitted order records.",
        unit: "records" as const,
      },
      evidence: {
        aggregateCounts: [{ count: 2, label: "usable records" }],
        reasons: ["Required order fields were present."],
        rowNumbers: [1, 2],
      },
      explanation: "Both records contain the required order fields.",
      numerator: 2,
      provenance: {
        evaluator: "0g" as const,
        model: "test-model",
        provider: "test-provider",
        requestId: "test-request",
        teeVerified: true as const,
      },
      questionId: "q-orders",
      resultVersion: "3.0.0" as const,
      score: 100,
      scoreDefinition: {
        oneHundred: "Every record contains the required order fields.",
        zero: "No record contains the required order fields.",
      },
      status: "scored" as const,
    },
  ],
};

function dependencies(
  overrides: Partial<Parameters<typeof submitPrivateSample>[1]> = {},
) {
  return {
    beginSubmission: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockResolvedValue(undefined),
    emitInferenceEvents: vi.fn(),
    fail: vi.fn().mockResolvedValue(undefined),
    getSellerView: vi.fn().mockResolvedValue(SELLER_VIEW),
    parseSample: vi.fn(() => ({
      columnCount: 2,
      columns: ["order_id", "order_date"],
      rowCount: 2,
      rows: [
        ["private-order-1", "2026-07-20"],
        ["private-order-2", "2026-07-21"],
      ],
    })),
    scoreSample: vi.fn().mockResolvedValue(VERIFIED_RESULT),
    ...overrides,
  };
}

describe("submitPrivateSample", () => {
  it("persists only questions, safe results, counts, and verification metadata", async () => {
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

    expect(deps.scoreSample).toHaveBeenCalledOnce();
    expect(deps.scoreSample).toHaveBeenCalledWith({
      evaluationId: "evaluation-1",
      questions: QUESTIONS,
      sample: expect.objectContaining({
        columns: ["order_id", "order_date"],
        rowCount: 2,
      }),
    });
    expect(deps.complete).toHaveBeenCalledWith("evaluation-1", {
      inferenceDiagnostics: INFERENCE_DIAGNOSTICS,
      questionIds: ["q-orders"],
      results: VERIFIED_RESULT.results,
      sampleColumnCount: 2,
      sampleRowCount: 2,
    });

    const persistenceCalls = JSON.stringify([
      vi.mocked(deps.beginSubmission).mock.calls,
      vi.mocked(deps.complete).mock.calls,
    ]);
    expect(persistenceCalls).not.toContain("private-order-1");
    expect(persistenceCalls).not.toContain("2026-07-20");
    expect(persistenceCalls).not.toContain("order_id,order_date");
    expect(deps.emitInferenceEvents).toHaveBeenCalledWith(
      "evaluation-1",
      "complete",
      INFERENCE_DIAGNOSTICS,
    );
  });

  it("does not claim or call 0G when CSV validation fails", async () => {
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
      new ZeroGClientError("Unauthorized.", "request_failed", 401),
      "zero_g_authentication_failed",
    ],
    [
      new ZeroGClientError("Router unavailable.", "request_failed", 503),
      "zero_g_unavailable",
    ],
  ])(
    "stores a failed evaluation and never calls complete for %s",
    async (error, errorCode) => {
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
        expect.objectContaining({
          requestCount: expect.any(Object),
          requests: expect.any(Array),
        }),
      );
      expect(deps.complete).not.toHaveBeenCalled();
    },
  );
});
