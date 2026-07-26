import type { ParsedCsvSample } from "../csv/parse-sample";
import type { EvaluationQuestion } from "../evaluation-plans/types";
import type { ZeroGTrace } from "../zero-g/client";
import {
  ZERO_G_RESULT_VERSION,
  type EvaluationBasisUnit,
  type EvaluationResult,
  type SafeAggregateCount,
  type SafeResultEvidence,
} from "./types";
import { requiresScoredResult } from "./evaluation-prompt";

const BASIS_UNITS = new Set<EvaluationBasisUnit>([
  "events",
  "expected_intervals",
  "fields",
  "holistic_rubric",
  "records",
]);
const TOP_LEVEL_KEYS = ["evaluation_id", "results"];
const RESULT_KEYS = [
  "confidence",
  "denominator",
  "evaluation_basis",
  "evidence",
  "explanation",
  "numerator",
  "question_id",
  "score",
  "score_definition",
  "status",
];

export type EvaluationOutputFailureCode =
  | "arithmetic_mismatch"
  | "duplicate_evidence_rows"
  | "incomplete_arithmetic"
  | "invalid_aggregate_count"
  | "invalid_envelope"
  | "invalid_evaluation_basis"
  | "invalid_evidence"
  | "invalid_json"
  | "invalid_numeric_value"
  | "invalid_result_shape"
  | "invalid_score_definition"
  | "invalid_status"
  | "invalid_text"
  | "invalid_unable_arithmetic"
  | "missing_count_arithmetic"
  | "missing_or_duplicate_question"
  | "private_value_copy"
  | "unexpected_unable";

export class EvaluationOutputError extends Error {
  constructor(
    readonly code: EvaluationOutputFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "EvaluationOutputError";
  }
}

export function parseEvaluationOutput(input: {
  content: string;
  evaluationId: string;
  questions: EvaluationQuestion[];
  sample: ParsedCsvSample;
  trace: ZeroGTrace;
}): EvaluationResult[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input.content);
  } catch {
    throw new EvaluationOutputError(
      "invalid_json",
      "0G returned invalid JSON.",
    );
  }

  if (
    !isRecord(parsed) ||
    !hasExactKeys(parsed, TOP_LEVEL_KEYS) ||
    parsed.evaluation_id !== input.evaluationId ||
    !Array.isArray(parsed.results) ||
    parsed.results.length !== input.questions.length
  ) {
    throw new EvaluationOutputError(
      "invalid_envelope",
      "0G returned an invalid evaluation envelope.",
    );
  }

  const expectedIds = new Set(
    input.questions.map((question) => question.id),
  );
  const questionsById = new Map(
    input.questions.map((question) => [question.id, question]),
  );
  const seenIds = new Set<string>();
  const forbiddenValues = privateCellValues(
    input.sample,
    input.questions,
  );
  const results = parsed.results.map((value) =>
    parseResult(
      value,
      expectedIds,
      questionsById,
      seenIds,
      input.sample,
      forbiddenValues,
      input.trace,
    ),
  );

  if (
    seenIds.size !== expectedIds.size ||
    [...expectedIds].some((id) => !seenIds.has(id))
  ) {
    throw new EvaluationOutputError(
      "missing_or_duplicate_question",
      "0G did not return every original question exactly once.",
    );
  }

  return results;
}

function parseResult(
  value: unknown,
  expectedIds: Set<string>,
  questionsById: Map<string, EvaluationQuestion>,
  seenIds: Set<string>,
  sample: ParsedCsvSample,
  forbiddenValues: string[],
  trace: ZeroGTrace,
): EvaluationResult {
  if (!isRecord(value) || !hasExactKeys(value, RESULT_KEYS)) {
    throw new EvaluationOutputError(
      "invalid_result_shape",
      "0G returned an invalid result object.",
    );
  }

  const questionId = readQuestionId(
    value.question_id,
    expectedIds,
    seenIds,
  );
  const status = value.status;
  const score = value.score;
  const numerator = value.numerator;
  const denominator = value.denominator;
  const confidence = readInteger(value.confidence, 0, 100);
  const scoreDefinition = readScoreDefinition(
    value.score_definition,
    forbiddenValues,
  );
  const evaluationBasis = readEvaluationBasis(
    value.evaluation_basis,
    forbiddenValues,
  );
  const explanation = readSafeText(
    value.explanation,
    "explanation",
    forbiddenValues,
    800,
  );
  const evidence = readEvidence(
    value.evidence,
    sample,
    forbiddenValues,
  );
  const provenance = {
    evaluator: "0g" as const,
    model: trace.model,
    provider: trace.provider,
    requestId: trace.requestId,
    teeVerified: true as const,
  };

  if (status === "unable") {
    const question = questionsById.get(questionId);

    if (
      question &&
      requiresScoredResult(question, sample.columns)
    ) {
      throw new EvaluationOutputError(
        "unexpected_unable",
        "0G marked a structurally answerable aggregate question as unable.",
      );
    }

    if (score !== null || numerator !== null || denominator !== null) {
      throw new EvaluationOutputError(
        "invalid_unable_arithmetic",
        "An unable result must not contain a score or arithmetic.",
      );
    }

    return {
      confidence,
      denominator: null,
      evaluationBasis,
      evidence,
      explanation,
      numerator: null,
      provenance,
      questionId,
      resultVersion: ZERO_G_RESULT_VERSION,
      score: null,
      scoreDefinition,
      status,
    };
  }

  if (status !== "scored") {
    throw new EvaluationOutputError(
      "invalid_status",
      "A result status must be scored or unable.",
    );
  }

  const numericScore = readInteger(score, 0, 100);

  if ((numerator === null) !== (denominator === null)) {
    throw new EvaluationOutputError(
      "incomplete_arithmetic",
      "Numerator and denominator must both be present or both be null.",
    );
  }

  if (
    evaluationBasis.unit !== "holistic_rubric" &&
    numerator === null
  ) {
    throw new EvaluationOutputError(
      "missing_count_arithmetic",
      "Count-based results require a numerator and denominator.",
    );
  }

  if (numerator !== null && denominator !== null) {
    const numericNumerator = readInteger(
      numerator,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    const numericDenominator = readInteger(
      denominator,
      1,
      Number.MAX_SAFE_INTEGER,
    );

    if (
      numericNumerator > numericDenominator ||
      Math.round((numericNumerator / numericDenominator) * 100) !==
        numericScore
    ) {
      throw new EvaluationOutputError(
        "arithmetic_mismatch",
        "The result score does not match its numerator and denominator.",
      );
    }
  }

  return {
    confidence,
    denominator: denominator as number | null,
    evaluationBasis,
    evidence,
    explanation,
    numerator: numerator as number | null,
    provenance,
    questionId,
    resultVersion: ZERO_G_RESULT_VERSION,
    score: numericScore,
    scoreDefinition,
    status,
  };
}

function readQuestionId(
  value: unknown,
  expectedIds: Set<string>,
  seenIds: Set<string>,
) {
  if (
    typeof value !== "string" ||
    !expectedIds.has(value) ||
    seenIds.has(value)
  ) {
    throw new EvaluationOutputError(
      "missing_or_duplicate_question",
      "0G returned a missing, duplicate, or invented question ID.",
    );
  }

  seenIds.add(value);
  return value;
}

function readScoreDefinition(
  value: unknown,
  forbiddenValues: string[],
) {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["one_hundred", "zero"])
  ) {
    throw new EvaluationOutputError(
      "invalid_score_definition",
      "A score definition must define zero and one hundred.",
    );
  }

  return {
    oneHundred: readSafeText(
      value.one_hundred,
      "score definition",
      forbiddenValues,
      400,
    ),
    zero: readSafeText(
      value.zero,
      "score definition",
      forbiddenValues,
      400,
    ),
  };
}

function readEvaluationBasis(
  value: unknown,
  forbiddenValues: string[],
) {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["description", "unit"]) ||
    typeof value.unit !== "string" ||
    !BASIS_UNITS.has(value.unit as EvaluationBasisUnit)
  ) {
    throw new EvaluationOutputError(
      "invalid_evaluation_basis",
      "The evaluation basis is invalid.",
    );
  }

  return {
    description: readSafeText(
      value.description,
      "evaluation basis",
      forbiddenValues,
      400,
    ),
    unit: value.unit as EvaluationBasisUnit,
  };
}

function readEvidence(
  value: unknown,
  sample: ParsedCsvSample,
  forbiddenValues: string[],
): SafeResultEvidence {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "aggregate_counts",
      "reasons",
      "row_numbers",
    ]) ||
    !Array.isArray(value.row_numbers) ||
    !Array.isArray(value.aggregate_counts) ||
    !Array.isArray(value.reasons)
  ) {
    throw new EvaluationOutputError(
      "invalid_evidence",
      "The result evidence is invalid.",
    );
  }

  const rowNumbers = value.row_numbers.map((rowNumber) =>
    readInteger(rowNumber, 1, sample.rowCount),
  );

  if (new Set(rowNumbers).size !== rowNumbers.length) {
    throw new EvaluationOutputError(
      "duplicate_evidence_rows",
      "Evidence row numbers must be unique.",
    );
  }

  const aggregateCounts = value.aggregate_counts.map((item) =>
    readAggregateCount(item, forbiddenValues),
  );
  const reasons = value.reasons.map((reason) =>
    readSafeText(reason, "evidence reason", forbiddenValues, 240),
  );

  return { aggregateCounts, reasons, rowNumbers };
}

function readAggregateCount(
  value: unknown,
  forbiddenValues: string[],
): SafeAggregateCount {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["count", "label"])
  ) {
    throw new EvaluationOutputError(
      "invalid_aggregate_count",
      "An aggregate evidence count is invalid.",
    );
  }

  return {
    count: readInteger(value.count, 0, Number.MAX_SAFE_INTEGER),
    label: readSafeText(
      value.label,
      "aggregate count label",
      forbiddenValues,
      120,
    ),
  };
}

function readSafeText(
  value: unknown,
  field: string,
  forbiddenValues: string[],
  maximumLength: number,
) {
  if (typeof value !== "string") {
    throw new EvaluationOutputError(
      "invalid_text",
      `The ${field} must be text.`,
    );
  }

  const text = value.trim();

  if (text.length < 1 || text.length > maximumLength) {
    throw new EvaluationOutputError(
      "invalid_text",
      `The ${field} has an invalid length.`,
    );
  }

  const normalized = text.toLocaleLowerCase("en-US");

  if (forbiddenValues.some((cell) => normalized.includes(cell))) {
    throw new EvaluationOutputError(
      "private_value_copy",
      `The ${field} copied a private dataset cell value.`,
    );
  }

  return text;
}

function privateCellValues(
  sample: ParsedCsvSample,
  questions: EvaluationQuestion[],
) {
  const publicContext = [
    ...sample.columns,
    ...questions.map((question) => question.question),
  ]
    .join(" ")
    .toLocaleLowerCase("en-US");

  return [
    ...new Set(
      sample.rows
        .flat()
        .map((value) => value.trim().toLocaleLowerCase("en-US"))
        .filter(
          (value) =>
            value.length >= 6 && !publicContext.includes(value),
        ),
    ),
  ];
}

function readInteger(value: unknown, minimum: number, maximum: number) {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < minimum ||
    Number(value) > maximum
  ) {
    throw new EvaluationOutputError(
      "invalid_numeric_value",
      "0G returned a numeric value outside the allowed range.",
    );
  }

  return Number(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: string[],
) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();

  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
