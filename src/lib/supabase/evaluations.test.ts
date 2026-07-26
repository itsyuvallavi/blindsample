import { describe, expect, it } from "vitest";

import type { EvaluationRunDiagnostics } from "../scoring/run-diagnostics";
import type { EvaluationResult } from "../scoring/types";

import {
  toBuyerQuestionResult,
  toStoredRunDiagnostics,
} from "./evaluations";

const BASE_RESULT = {
  confidence: 91,
  denominator: 5,
  evaluationBasis: {
    description: "Five submitted records.",
    unit: "records",
  },
  evidence: {
    aggregateCounts: [{ count: 4, label: "matching records" }],
    reasons: ["Row 3 contained a private value."],
    rowNumbers: [1, 2, 4, 5],
  },
  explanation: "Four of five records matched.",
  numerator: 4,
  provenance: {
    evaluator: "0g",
    model: "private-model",
    provider: "private-provider",
    requestId: "request-1",
    teeVerified: true,
  },
  questionId: "q1",
  resultVersion: "3.0.0",
  scoreDefinition: {
    oneHundred: "Every record matches.",
    zero: "No records match.",
  },
} satisfies Omit<EvaluationResult, "score" | "status">;

describe("buyer result privacy boundary", () => {
  it("returns a count-free scored summary", () => {
    const result = toBuyerQuestionResult({
      ...BASE_RESULT,
      score: 80,
      status: "scored",
    });

    expect(result).toEqual({
      confidence: 91,
      evaluatedBy: "0g",
      explanation:
        "The submitted sample strongly met this requirement.",
      questionId: "q1",
      score: 80,
      status: "scored",
      teeVerified: true,
    });
    expect(JSON.stringify(result)).not.toContain("Five");
    expect(JSON.stringify(result)).not.toContain("4");
    expect(JSON.stringify(result)).not.toContain("Row");
  });

  it("returns a generic unable explanation without model evidence", () => {
    const result = toBuyerQuestionResult({
      ...BASE_RESULT,
      denominator: null,
      numerator: null,
      score: null,
      status: "unable",
    });

    expect(result.explanation).toBe(
      "0G could not identify enough relevant evidence in the submitted sample to score this question safely.",
    );
    expect(JSON.stringify(result)).not.toContain("private value");
  });
});

describe("stored inference diagnostics", () => {
  it("persists the bounded request audit without parser state or content", () => {
    const diagnostics = {
      outputValidation: {
        failureCode: "invalid_json",
        status: "failed",
      },
      requestCount: { made: 1, maximum: 1 },
      requests: [
        {
          attempt: 1,
          billing: {
            inputCostNeuron: null,
            outputCostNeuron: null,
            totalCostNeuron: null,
          },
          durationMs: 125,
          finishReason: "stop",
          httpStatus: 200,
          model: "private-model",
          outcome: "succeeded",
          provider: "private-provider",
          reasoningContentPresent: false,
          requestId: "request-1",
          responseLength: 321,
          teeVerified: true,
          usage: {
            completionTokens: 100,
            promptTokens: 200,
            reasoningTokens: 0,
            totalTokens: 300,
          },
        },
      ],
    } satisfies EvaluationRunDiagnostics;

    const stored = toStoredRunDiagnostics(diagnostics);
    const serialized = JSON.stringify(stored);

    expect(stored).toMatchObject({
      requestCount: { made: 1, maximum: 1 },
      requests: [{ requestId: "request-1", teeVerified: true }],
    });
    expect(serialized).not.toContain("outputValidation");
    expect(serialized).not.toContain("invalid_json");
    expect(serialized).not.toContain('"content"');
    expect(serialized).not.toContain("rawResponse");
    expect(serialized).not.toContain("responseContent");
  });
});
