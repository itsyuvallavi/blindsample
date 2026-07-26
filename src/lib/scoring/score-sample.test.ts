import { describe, expect, it, vi } from "vitest";

import type { ParsedCsvSample } from "../csv/parse-sample";
import { compileEvaluationContracts } from "../evaluation-contracts/compile";
import type { VerifiedCompletion } from "../zero-g/client";
import { prepareSemanticRecords } from "./semantic";
import { scorePrivateCsvSample } from "./score-sample";

const CONTRACTS = compileEvaluationContracts([
  {
    columns: ["id", "text"],
    id: "available",
    kind: "column_availability",
    question: "Are the required columns available?",
  },
  {
    columns: ["text"],
    controls: {
      intermediate: "A general product question.",
      negative: "A weather report unrelated to customer service.",
      positive: "A customer asks an agent to fix a billing error.",
    },
    id: "relevance",
    kind: "semantic_relevance",
    question: "Is this useful for support classification?",
    target: "Customer support requests requiring an agent response.",
  },
]);

const SAMPLE: ParsedCsvSample = {
  columnCount: 2,
  columns: ["id", "text"],
  rowCount: 5,
  rows: [
    ["1", "billing problem"],
    ["2", "weather report"],
    ["3", "product question"],
    ["4", "account locked"],
    ["5", "refund request"],
  ],
};

const TRACE: VerifiedCompletion["trace"] = {
  model: "test-model",
  provider: "test-provider",
  requestId: "test-request",
  teeVerified: true,
};

function semanticCompletion(requestId: string) {
  const semanticContract = CONTRACTS[1];
  const ids = prepareSemanticRecords(semanticContract, SAMPLE).map(
    (record) => record.recordId,
  );

  return {
    content: JSON.stringify({
      classifications: ids.map((recordId) => ({
        label: "strong",
        recordId,
      })),
      controls: [
        { controlId: "control_a", label: "negative" },
        { controlId: "control_b", label: "positive" },
        { controlId: "control_c", label: "intermediate" },
      ],
    }),
    trace: { ...TRACE, requestId },
  };
}

describe("scorePrivateCsvSample", () => {
  it("returns exactly one independent result per approved contract", async () => {
    const requestCompletion = vi
      .fn()
      .mockResolvedValueOnce(semanticCompletion("original"))
      .mockResolvedValueOnce(semanticCompletion("repeat"));

    const scoring = await scorePrivateCsvSample(CONTRACTS, SAMPLE, {
      requestCompletion,
    });

    expect(scoring.semanticVerification).toBe("verified");
    expect(scoring.results).toHaveLength(CONTRACTS.length);
    expect(scoring.results.map((result) => result.questionId)).toEqual(
      CONTRACTS.map((contract) => contract.questionId),
    );
    expect(scoring.results).toEqual([
      expect.objectContaining({
        questionId: "available",
        score: 100,
        status: "scored",
      }),
      expect.objectContaining({
        questionId: "relevance",
        score: 75,
        status: "scored",
      }),
    ]);
    expect(scoring).not.toHaveProperty("overallScore");
    expect(JSON.stringify(scoring)).not.toContain("overallScore");
  });

  it("does not call 0G for a preflight semantic unable result", async () => {
    const tooSmall = {
      ...SAMPLE,
      rowCount: 1,
      rows: [SAMPLE.rows[0]],
    };
    const requestCompletion = vi.fn();

    const scoring = await scorePrivateCsvSample(CONTRACTS, tooSmall, {
      requestCompletion,
    });

    expect(scoring.semanticVerification).toBe("not_run");
    expect(scoring.results[1]).toMatchObject({
      reason: "insufficient_records",
      score: null,
      status: "unable_to_score",
    });
    expect(requestCompletion).not.toHaveBeenCalled();
  });

  it("rejects an all-deterministic contract set", async () => {
    await expect(
      scorePrivateCsvSample([CONTRACTS[0]], SAMPLE),
    ).rejects.toThrow("requires at least one semantic");
  });
});
