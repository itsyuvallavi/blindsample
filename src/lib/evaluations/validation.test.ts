import { describe, expect, it } from "vitest";

import { PRODUCT_LIMITS } from "../product-contract";
import {
  EvaluationInputError,
  validateEvaluationDraft,
} from "./validation";

const QUESTIONS = [
  {
    id: "btc_completeness",
    question:
      "What percentage of records contain timestamp and close values?",
  },
];

describe("evaluation input validation", () => {
  it("accepts only an evaluation name and plain-text questions", () => {
    const result = validateEvaluationDraft({
      questions: QUESTIONS,
      title: "  BTC data  ",
    });

    expect(result).toEqual({
      questions: QUESTIONS,
      questionSetHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      title: "BTC data",
    });
  });

  it("rejects hidden buyer-authored plans and technical fields", () => {
    expect(() =>
      validateEvaluationDraft({
        questions: [
          {
            ...QUESTIONS[0],
            columns: ["message"],
            kind: "semantic_relevance",
          },
        ],
        title: "BTC data",
      }),
    ).toThrowError(EvaluationInputError);

    expect(() =>
      validateEvaluationDraft({
        criteria: [],
        questions: QUESTIONS,
        title: "BTC data",
      }),
    ).toThrow("only a title and plain-text questions");
  });

  it("rejects duplicate question IDs", () => {
    expect(() =>
      validateEvaluationDraft({
        questions: [QUESTIONS[0], QUESTIONS[0]],
        title: "BTC data",
      }),
    ).toThrow("invalid");
  });

  it("enforces question count and text limits", () => {
    expect(() =>
      validateEvaluationDraft({
        questions: [],
        title: "BTC data",
      }),
    ).toThrow("between 1");
    expect(() =>
      validateEvaluationDraft({
        questions: Array.from(
          { length: PRODUCT_LIMITS.maximumQuestions + 1 },
          (_, index) => ({
            id: `q${index}`,
            question: "Is this question answerable?",
          }),
        ),
        title: "BTC data",
      }),
    ).toThrow("between 1");
    expect(() =>
      validateEvaluationDraft({
        questions: [
          {
            id: "too_long",
            question: "x".repeat(
              PRODUCT_LIMITS.maximumQuestionCharacters + 1,
            ),
          },
        ],
        title: "BTC data",
      }),
    ).toThrow("characters");
  });
});
