import { PRODUCT_LIMITS } from "../product-contract";
import type { EvaluationQuestion } from "../supabase/evaluations";

const QUESTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type ValidatedEvaluationDraft = {
  questions: EvaluationQuestion[];
  title: string;
};

export class EvaluationInputError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_evaluation"
      | "invalid_question"
      | "invalid_title",
  ) {
    super(message);
    this.name = "EvaluationInputError";
  }
}

export function validateEvaluationDraft(
  value: unknown,
): ValidatedEvaluationDraft {
  if (!isRecord(value) || !hasExactKeys(value, ["questions", "title"])) {
    throw new EvaluationInputError(
      "Evaluation input must contain only a title and questions.",
      "invalid_evaluation",
    );
  }

  return {
    questions: validateQuestions(value.questions),
    title: validateTitle(value.title),
  };
}

export function validateQuestions(value: unknown): EvaluationQuestion[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > PRODUCT_LIMITS.maximumQuestions
  ) {
    throw new EvaluationInputError(
      `Provide between 1 and ${PRODUCT_LIMITS.maximumQuestions} questions.`,
      "invalid_question",
    );
  }

  const ids = new Set<string>();

  return value.map((question, index) => {
    if (
      !isRecord(question) ||
      !hasExactKeys(question, ["id", "text"]) ||
      typeof question.id !== "string" ||
      !QUESTION_ID_PATTERN.test(question.id) ||
      typeof question.text !== "string"
    ) {
      throw new EvaluationInputError(
        `Question ${index + 1} has an invalid shape.`,
        "invalid_question",
      );
    }

    if (ids.has(question.id)) {
      throw new EvaluationInputError(
        "Question IDs must be unique.",
        "invalid_question",
      );
    }

    const text = question.text.trim();

    if (
      text.length < 1 ||
      text.length > PRODUCT_LIMITS.maximumQuestionCharacters
    ) {
      throw new EvaluationInputError(
        `Question ${index + 1} must contain 1–${PRODUCT_LIMITS.maximumQuestionCharacters} characters.`,
        "invalid_question",
      );
    }

    ids.add(question.id);
    return { id: question.id, text };
  });
}

function validateTitle(value: unknown) {
  if (typeof value !== "string") {
    throw new EvaluationInputError(
      "Evaluation title must be text.",
      "invalid_title",
    );
  }

  const title = value.trim();

  if (
    title.length < 1 ||
    title.length > PRODUCT_LIMITS.maximumTitleCharacters
  ) {
    throw new EvaluationInputError(
      `Evaluation title must contain 1–${PRODUCT_LIMITS.maximumTitleCharacters} characters.`,
      "invalid_title",
    );
  }

  return title;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: string[],
) {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every(
      (key, index) => key === sortedExpectedKeys[index],
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
