import type { CriterionDraft } from "../evaluation-contracts/types";

export const EVALUATION_DRAFT_STORAGE_KEY =
  "blindsample:evaluation-draft:v1";

export type EvaluationDraft = {
  criteria: CriterionDraft[];
  semanticReviewFingerprints: Record<string, string>;
  title: string;
};

type StoredEvaluationDraft = EvaluationDraft & {
  version: 1;
};

export function serializeEvaluationDraft(draft: EvaluationDraft) {
  return JSON.stringify({
    ...draft,
    version: 1,
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
    value.version !== 1 ||
    typeof value.title !== "string" ||
    !Array.isArray(value.criteria) ||
    value.criteria.length < 1 ||
    !value.criteria.every(isCriterionDraft) ||
    !isStringRecord(value.semanticReviewFingerprints)
  ) {
    return null;
  }

  return {
    criteria: value.criteria,
    semanticReviewFingerprints:
      value.semanticReviewFingerprints,
    title: value.title,
  };
}

function isCriterionDraft(value: unknown): value is CriterionDraft {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.question !== "string" ||
    typeof value.kind !== "string"
  ) {
    return false;
  }

  switch (value.kind) {
    case "completeness":
    case "column_availability":
      return isStringArray(value.columns);
    case "format_validity":
      return (
        typeof value.column === "string" &&
        ["email", "iso_date", "number", "url", "uuid"].includes(
          String(value.format),
        )
      );
    case "uniqueness":
      return typeof value.column === "string";
    case "date_freshness":
      return (
        typeof value.column === "string" &&
        typeof value.maximumAgeDays === "number" &&
        Number.isFinite(value.maximumAgeDays) &&
        typeof value.referenceDate === "string"
      );
    case "numeric_range":
      return (
        typeof value.column === "string" &&
        typeof value.minimum === "number" &&
        Number.isFinite(value.minimum) &&
        typeof value.maximum === "number" &&
        Number.isFinite(value.maximum)
      );
    case "category_coverage":
      return (
        typeof value.column === "string" &&
        isStringArray(value.expectedValues)
      );
    case "semantic_relevance":
      return (
        isStringArray(value.columns) &&
        typeof value.target === "string" &&
        isRecord(value.controls) &&
        typeof value.controls.negative === "string" &&
        typeof value.controls.intermediate === "string" &&
        typeof value.controls.positive === "string"
      );
    default:
      return false;
  }
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  );
}

function isStringRecord(
  value: unknown,
): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
