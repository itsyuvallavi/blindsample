export const RUBRIC_LABELS = [
  "negative",
  "weak",
  "intermediate",
  "strong",
  "positive",
  "insufficient",
] as const;

export type RubricLabel = (typeof RUBRIC_LABELS)[number];

export type SemanticClassificationOutput = {
  classifications: {
    label: RubricLabel;
    recordId: string;
  }[];
  controls: {
    controlId: string;
    label: RubricLabel;
  }[];
};

export class SemanticOutputError extends Error {
  constructor(
    message: string,
    readonly code: "empty_output" | "invalid_json" | "invalid_shape",
  ) {
    super(message);
    this.name = "SemanticOutputError";
  }
}

export function parseSemanticClassificationOutput(
  content: string,
  expectedRecordIds: string[],
  expectedControlIds: string[],
): SemanticClassificationOutput {
  if (content.trim().length === 0) {
    throw new SemanticOutputError(
      "The semantic response was empty.",
      "empty_output",
    );
  }

  let value: unknown;

  try {
    value = JSON.parse(content);
  } catch {
    throw new SemanticOutputError(
      "The semantic response was not valid JSON.",
      "invalid_json",
    );
  }

  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["classifications", "controls"])
  ) {
    throw new SemanticOutputError(
      "The semantic response has an invalid top-level shape.",
      "invalid_shape",
    );
  }

  return {
    classifications: parseItems(
      value.classifications,
      "recordId",
      expectedRecordIds,
    ),
    controls: parseItems(
      value.controls,
      "controlId",
      expectedControlIds,
    ),
  };
}

function parseItems<T extends "controlId" | "recordId">(
  value: unknown,
  idKey: T,
  expectedIds: string[],
): Array<{ label: RubricLabel } & Record<T, string>> {
  if (!Array.isArray(value) || value.length !== expectedIds.length) {
    throw new SemanticOutputError(
      `The semantic response must contain one item per ${idKey}.`,
      "invalid_shape",
    );
  }

  const expected = new Set(expectedIds);
  const seen = new Set<string>();
  const parsed = value.map((item) => {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, [idKey, "label"]) ||
      typeof item[idKey] !== "string" ||
      !expected.has(item[idKey]) ||
      seen.has(item[idKey]) ||
      !RUBRIC_LABELS.includes(item.label as RubricLabel)
    ) {
      throw new SemanticOutputError(
        "The semantic response contains an invalid classification.",
        "invalid_shape",
      );
    }

    seen.add(item[idKey]);
    return {
      [idKey]: item[idKey],
      label: item.label as RubricLabel,
    } as { label: RubricLabel } & Record<T, string>;
  });

  if (seen.size !== expected.size) {
    throw new SemanticOutputError(
      "The semantic response is missing a classification.",
      "invalid_shape",
    );
  }

  return expectedIds.map(
    (id) => parsed.find((item) => item[idKey] === id) as (typeof parsed)[number],
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: string[],
) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
