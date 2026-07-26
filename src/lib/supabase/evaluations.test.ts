import { describe, expect, it } from "vitest";

import type { EvaluationResult } from "../scoring/types";

import { toBuyerQuestionResult } from "./evaluations";

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
      "0G could not safely answer this question from the submitted sample.",
    );
    expect(JSON.stringify(result)).not.toContain("private value");
  });
});
