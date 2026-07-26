import { describe, expect, it } from "vitest";

import { PRODUCT_LIMITS } from "../product-contract";
import {
  EvaluationInputError,
  validateEvaluationDraft,
  validateQuestions,
} from "./validation";

describe("evaluation input validation", () => {
  it("trims safe human-entered text without changing question IDs", () => {
    expect(
      validateEvaluationDraft({
        questions: [{ id: "question_1", text: "  Is it complete?  " }],
        title: "  Order data  ",
      }),
    ).toEqual({
      questions: [{ id: "question_1", text: "Is it complete?" }],
      title: "Order data",
    });
  });

  it("rejects extra fields and duplicate question IDs", () => {
    expect(() =>
      validateEvaluationDraft({
        overallScore: true,
        questions: [{ id: "q1", text: "Is it complete?" }],
        title: "Orders",
      }),
    ).toThrowError(EvaluationInputError);

    expect(() =>
      validateQuestions([
        { id: "q1", text: "Is it complete?" },
        { id: "q1", text: "Is it current?" },
      ]),
    ).toThrow("unique");
  });

  it("enforces the question count and text limits", () => {
    expect(() => validateQuestions([])).toThrow("between 1");
    expect(() =>
      validateQuestions(
        Array.from(
          { length: PRODUCT_LIMITS.maximumQuestions + 1 },
          (_, index) => ({
            id: `q${index}`,
            text: "Question",
          }),
        ),
      ),
    ).toThrow("between 1");
    expect(() =>
      validateQuestions([
        {
          id: "q1",
          text: "x".repeat(
            PRODUCT_LIMITS.maximumQuestionCharacters + 1,
          ),
        },
      ]),
    ).toThrow("characters");
  });

  it("rejects IDs that are unsafe for exact model matching", () => {
    for (const id of ["", "contains space", "q/1", "x".repeat(65)]) {
      expect(() =>
        validateQuestions([{ id, text: "Is it complete?" }]),
      ).toThrowError(EvaluationInputError);
    }
  });
});
