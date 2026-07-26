import { hashEvaluationQuestions } from "../evaluation-contracts/hash";
import type { EvaluationQuestion } from "../evaluation-plans/types";
import { PRODUCT_LIMITS } from "../product-contract";
import type { CreateEvaluationInput } from "../supabase/evaluations";

const QUESTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type ValidatedEvaluationDraft = CreateEvaluationInput;

export class EvaluationInputError extends Error {
  constructor(
    message: string,
    readonly code:
      | "approval_mismatch"
      | "clarification_required"
      | "invalid_contract"
      | "invalid_evaluation"
      | "invalid_title"
      | "semantic_criterion_required",
  ) {
    super(message);
    this.name = "EvaluationInputError";
  }
}

export function validateEvaluationDraft(
  value: unknown,
): ValidatedEvaluationDraft {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["questions", "title"])
  ) {
    throw new EvaluationInputError(
      "Evaluation input must contain only a title and plain-text questions.",
      "invalid_evaluation",
    );
  }

  const questions = validateQuestions(value.questions);

  return {
    questionSetHash: hashEvaluationQuestions(questions),
    questions,
    title: validateTitle(value.title),
  };
}

function validateQuestions(value: unknown): EvaluationQuestion[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > PRODUCT_LIMITS.maximumQuestions
  ) {
    throw new EvaluationInputError(
      `Provide between 1 and ${PRODUCT_LIMITS.maximumQuestions} questions.`,
      "invalid_evaluation",
    );
  }

  const ids = new Set<string>();

  return value.map((item, index) => {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["id", "question"]) ||
      typeof item.id !== "string" ||
      !QUESTION_ID_PATTERN.test(item.id) ||
      ids.has(item.id) ||
      typeof item.question !== "string"
    ) {
      throw new EvaluationInputError(
        `Question ${index + 1} is invalid.`,
        "invalid_evaluation",
      );
    }

    const question = item.question.trim();

    if (
      question.length < 1 ||
      question.length > PRODUCT_LIMITS.maximumQuestionCharacters
    ) {
      throw new EvaluationInputError(
        `Question ${index + 1} must contain 1–${PRODUCT_LIMITS.maximumQuestionCharacters} characters.`,
        "clarification_required",
      );
    }

    ids.add(item.id);
    return { id: item.id, question };
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
