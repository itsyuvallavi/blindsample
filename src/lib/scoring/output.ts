import { isValidScore } from "../product-contract";
import type {
  EvaluationQuestion,
  EvaluationScore,
} from "../supabase/evaluations";

export class ScoringOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringOutputError";
  }
}

export function parseScoringOutput(
  content: string,
  questions: EvaluationQuestion[],
): EvaluationScore[] {
  let value: unknown;

  try {
    value = JSON.parse(content);
  } catch {
    throw new ScoringOutputError(
      "The scoring response was not valid JSON.",
    );
  }

  if (!isRecord(value) || !hasExactKeys(value, ["scores"])) {
    throw new ScoringOutputError(
      "The scoring response must contain only a scores array.",
    );
  }

  if (
    !Array.isArray(value.scores) ||
    value.scores.length !== questions.length
  ) {
    throw new ScoringOutputError(
      "The scoring response must contain one score per question.",
    );
  }

  const expectedIds = new Set(questions.map((question) => question.id));
  const scoresById = new Map<string, number>();

  for (const item of value.scores) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["questionId", "score"]) ||
      typeof item.questionId !== "string" ||
      !expectedIds.has(item.questionId) ||
      !isValidScore(item.score) ||
      scoresById.has(item.questionId)
    ) {
      throw new ScoringOutputError(
        "The scoring response contains an invalid or duplicate score.",
      );
    }

    scoresById.set(item.questionId, item.score);
  }

  if (scoresById.size !== expectedIds.size) {
    throw new ScoringOutputError(
      "The scoring response is missing a question score.",
    );
  }

  return questions.map((question) => ({
    questionId: question.id,
    score: scoresById.get(question.id) as number,
  }));
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
