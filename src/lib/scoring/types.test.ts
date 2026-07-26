import { describe, expect, it } from "vitest";

import type { EvaluationRunDiagnostics } from "./run-diagnostics";
import {
  isAtomicVerifiedResultSet,
  type EvaluationResult,
} from "./types";

const QUESTIONS = [{ id: "q1", question: "Is this useful?" }];
const DIAGNOSTICS: EvaluationRunDiagnostics = {
  requestCount: { made: 1, maximum: 1 },
  requests: [
    {
      attempt: 1,
      billing: {
        inputCostNeuron: null,
        outputCostNeuron: null,
        totalCostNeuron: null,
      },
      durationMs: 1,
      finishReason: "stop",
      httpStatus: 200,
      model: "model",
      outcome: "succeeded",
      provider: "provider",
      reasoningContentPresent: false,
      requestId: "request",
      responseLength: 100,
      teeVerified: true,
      usage: {
        completionTokens: null,
        promptTokens: null,
        reasoningTokens: null,
        totalTokens: null,
      },
    },
  ],
};
const RESULT: EvaluationResult = {
  confidence: 90,
  denominator: 1,
  evaluationBasis: {
    description: "One submitted record.",
    unit: "records",
  },
  evidence: {
    aggregateCounts: [{ count: 1, label: "record evaluated" }],
    reasons: ["The record met the rubric."],
    rowNumbers: [1],
  },
  explanation: "The submitted record met the rubric.",
  numerator: 1,
  provenance: {
    evaluator: "0g",
    model: "model",
    provider: "provider",
    requestId: "request",
    teeVerified: true,
  },
  questionId: "q1",
  resultVersion: "3.0.0",
  score: 100,
  scoreDefinition: {
    oneHundred: "The record fully meets the rubric.",
    zero: "The record does not meet the rubric.",
  },
  status: "scored",
};

describe("isAtomicVerifiedResultSet", () => {
  it("accepts only the complete result set from the verified request", () => {
    expect(
      isAtomicVerifiedResultSet(QUESTIONS, [RESULT], DIAGNOSTICS),
    ).toBe(true);
  });

  it("fails closed for legacy, duplicated, or mismatched results", () => {
    expect(
      isAtomicVerifiedResultSet(
        QUESTIONS,
        [
          {
            questionId: "q1",
            score: 100,
            status: "scored",
          },
        ] as unknown as EvaluationResult[],
        DIAGNOSTICS,
      ),
    ).toBe(false);
    expect(
      isAtomicVerifiedResultSet(
        [QUESTIONS[0], QUESTIONS[0]],
        [RESULT, RESULT],
        DIAGNOSTICS,
      ),
    ).toBe(false);
    expect(
      isAtomicVerifiedResultSet(
        QUESTIONS,
        [
          {
            ...RESULT,
            provenance: {
              ...RESULT.provenance,
              requestId: "another-request",
            },
          },
        ],
        DIAGNOSTICS,
      ),
    ).toBe(false);
  });
});
