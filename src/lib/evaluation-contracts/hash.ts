import { createHash } from "node:crypto";

import type { EvaluationQuestion } from "../evaluation-plans/types";

export function hashEvaluationQuestions(
  questions: EvaluationQuestion[],
) {
  return createHash("sha256")
    .update(canonicalJson(questions))
    .digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${canonicalJson(item)}`,
      );

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}
