import type { EvaluationQuestion } from "../evaluation-plans/types";

export const EVALUATION_DRAFT_STORAGE_KEY =
  "blindsample:evaluation-draft:v2";

export type EvaluationDraft = {
  questions: EvaluationQuestion[];
  title: string;
};

type StoredEvaluationDraft = EvaluationDraft & {
  version: 2;
};

export function serializeEvaluationDraft(draft: EvaluationDraft) {
  return JSON.stringify({
    ...draft,
    version: 2,
  } satisfies StoredEvaluationDraft);
}

export function parseEvaluationDraft(
  serialized: string | null,
): EvaluationDraft | null {
  if (!serialized) {
    return null;
  }

  let value: unknown;

  try {
    value = JSON.parse(serialized);
  } catch {
    return null;
  }

  if (
    !isRecord(value) ||
    value.version !== 2 ||
    typeof value.title !== "string" ||
    !Array.isArray(value.questions) ||
    value.questions.length < 1 ||
    !value.questions.every(isEvaluationQuestion)
  ) {
    return null;
  }

  return {
    questions: value.questions,
    title: value.title,
  };
}

function isEvaluationQuestion(
  value: unknown,
): value is EvaluationQuestion {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    typeof value.id === "string" &&
    typeof value.question === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
