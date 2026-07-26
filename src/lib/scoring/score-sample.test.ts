import { describe, expect, it, vi } from "vitest";

import type { ParsedCsvSample } from "../csv/parse-sample";
import { compileEvaluationContracts } from "../evaluation-contracts/compile";
import {
  fingerprintQuestion,
  fingerprintSample,
} from "../evaluation-plans/generate";
import {
  EVALUATION_PLAN_VERSION,
  type GeneratedEvaluationPlan,
} from "../evaluation-plans/types";
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

function plansFor(sample: ParsedCsvSample): GeneratedEvaluationPlan[] {
  return CONTRACTS.map((contract) => ({
    confidence: 1,
    contract,
    datasetFingerprint: fingerprintSample(sample),
    evidenceNeeded: contract.requiredEvidence,
    explanation: "Test plan bound to this exact sample.",
    generationAttempt: 1,
    method: contract.method,
    originalQuestion: contract.originalQuestion,
    planVersion: EVALUATION_PLAN_VERSION,
    questionFingerprint: fingerprintQuestion({
      id: contract.questionId,
      question: contract.originalQuestion,
    }),
    questionId: contract.questionId,
    relevantColumns: contract.requiredColumns,
    scoreMeaning: {
      one: contract.scoringAnchors["1"],
      oneHundred: contract.scoringAnchors["100"],
    },
    status: "answerable",
    unableReason: null,
  }));
}

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
    diagnostics: [
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
        outcome: "succeeded" as const,
        reasoningContentPresent: false,
        responseLength: 100,
        usage: {
          completionTokens: 20,
          promptTokens: 10,
          reasoningTokens: 0,
          totalTokens: 30,
        },
      },
    ],
    trace: { ...TRACE, requestId },
  };
}

describe("scorePrivateCsvSample", () => {
  it("returns exactly one independent result per approved contract", async () => {
    const requestCompletion = vi
      .fn()
      .mockResolvedValueOnce(semanticCompletion("original"))
      .mockResolvedValueOnce(semanticCompletion("repeat"));

    const scoring = await scorePrivateCsvSample(plansFor(SAMPLE), SAMPLE, {
      requestCompletion,
    });

    expect(scoring.inferenceRequests).toEqual({
      made: 2,
      maximum: 6,
    });
    expect(scoring.diagnostics).toMatchObject({
      requestCount: { made: 2, maximum: 6 },
      requests: [
        {
          pass: "original",
          questionId: "relevance",
          requestId: "original",
        },
        {
          pass: "repeat",
          questionId: "relevance",
          requestId: "repeat",
        },
      ],
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

    const scoring = await scorePrivateCsvSample(plansFor(tooSmall), tooSmall, {
      requestCompletion,
    });

    expect(scoring.semanticVerification).toBe("not_run");
    expect(scoring.inferenceRequests).toEqual({
      made: 0,
      maximum: 6,
    });
    expect(scoring.diagnostics.requests).toEqual([]);
    expect(scoring.results[1]).toMatchObject({
      reason: "insufficient_records",
      score: null,
      status: "unable_to_score",
    });
    expect(requestCompletion).not.toHaveBeenCalled();
  });

  it("retains sanitized diagnostics when the original output is unusable", async () => {
    const requestCompletion = vi.fn().mockResolvedValueOnce({
      ...semanticCompletion("invalid-original"),
      content: "",
    });

    const scoring = await scorePrivateCsvSample(plansFor(SAMPLE), SAMPLE, {
      requestCompletion,
    });

    expect(requestCompletion).toHaveBeenCalledTimes(1);
    expect(scoring).toMatchObject({
      diagnostics: {
        requestCount: { made: 1, maximum: 6 },
        requests: [
          {
            pass: "original",
            questionId: "relevance",
            requestId: "invalid-original",
          },
        ],
      },
      inferenceRequests: { made: 1, maximum: 6 },
      semanticVerification: "verified",
    });
    expect(scoring.results[1]).toMatchObject({
      evidence: {
        semanticFailure: { kind: "empty", pass: "original" },
      },
      reason: "semantic_output_empty",
      score: null,
      status: "unable_to_score",
    });
  });

  it("runs an all-deterministic plan set without a 0G request", async () => {
    const requestCompletion = vi.fn();
    const scoring = await scorePrivateCsvSample(
      [plansFor(SAMPLE)[0]],
      SAMPLE,
      { requestCompletion },
    );

    expect(scoring.results[0]).toMatchObject({
      questionId: "available",
      score: 100,
      status: "scored",
    });
    expect(scoring.inferenceRequests.made).toBe(0);
    expect(requestCompletion).not.toHaveBeenCalled();
  });

  it("rejects an over-budget evaluation before making a request", async () => {
    const requestCompletion = vi.fn();

    const rejected = scorePrivateCsvSample(plansFor(SAMPLE), SAMPLE, {
      maximumInferenceRequests: 1,
      requestCompletion,
    });

    await expect(rejected).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining(
          "exceeds its private inference request budget",
        ),
      }),
      diagnostics: {
        requestCount: { made: 0, maximum: 1 },
        requests: [],
      },
    });

    expect(requestCompletion).not.toHaveBeenCalled();
  });
});
