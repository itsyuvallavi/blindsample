import type { EvaluationQuestion } from "../evaluation-plans/types";
import type {
  EvaluationRunDiagnostics,
  InferenceRequestAudit,
} from "./run-diagnostics";

export const ZERO_G_RESULT_VERSION = "3.0.0" as const;

export type EvaluationBasisUnit =
  | "events"
  | "expected_intervals"
  | "fields"
  | "holistic_rubric"
  | "records";

export type SafeAggregateCount = {
  count: number;
  label: string;
};

export type SafeResultEvidence = {
  aggregateCounts: SafeAggregateCount[];
  reasons: string[];
  rowNumbers: number[];
};

export type ZeroGResultProvenance = {
  evaluator: "0g";
  model: string;
  provider: string;
  requestId: string;
  teeVerified: true;
};

type EvaluationResultBase = {
  confidence: number;
  evaluationBasis: {
    description: string;
    unit: EvaluationBasisUnit;
  };
  evidence: SafeResultEvidence;
  explanation: string;
  numerator: number | null;
  denominator: number | null;
  provenance: ZeroGResultProvenance;
  questionId: string;
  resultVersion: typeof ZERO_G_RESULT_VERSION;
  scoreDefinition: {
    oneHundred: string;
    zero: string;
  };
};

export type ScoredEvaluationResult = EvaluationResultBase & {
  denominator: number | null;
  numerator: number | null;
  score: number;
  status: "scored";
};

export type UnableEvaluationResult = EvaluationResultBase & {
  denominator: null;
  numerator: null;
  score: null;
  status: "unable";
};

export type EvaluationResult =
  | ScoredEvaluationResult
  | UnableEvaluationResult;

export function isAtomicVerifiedResultSet(
  questions: EvaluationQuestion[],
  results: EvaluationResult[] | null,
  diagnostics: EvaluationRunDiagnostics,
): results is EvaluationResult[] {
  if (
    !results ||
    results.length !== questions.length ||
    diagnostics.requestCount.made !== 1 ||
    diagnostics.requestCount.maximum !== 1 ||
    diagnostics.requests.length !== 1
  ) {
    return false;
  }

  const request = diagnostics.requests[0];

  if (!isSuccessfulVerifiedRequest(request)) {
    return false;
  }

  if (
    !results.every(
      (result) =>
        isRecord(result) && typeof result.questionId === "string",
    )
  ) {
    return false;
  }

  const expectedIds = new Set(questions.map((question) => question.id));
  const resultIds = new Set(results.map((result) => result.questionId));

  return (
    expectedIds.size === questions.length &&
    resultIds.size === results.length &&
    resultIds.size === expectedIds.size &&
    [...expectedIds].every((questionId) => resultIds.has(questionId)) &&
    results.every((result) =>
      isVerifiedPersistedResult(result, request),
    )
  );
}

function isSuccessfulVerifiedRequest(
  request: InferenceRequestAudit,
) {
  return (
    request.outcome === "succeeded" &&
    request.teeVerified === true &&
    typeof request.requestId === "string" &&
    typeof request.model === "string" &&
    typeof request.provider === "string"
  );
}

function isVerifiedPersistedResult(
  value: unknown,
  request: InferenceRequestAudit,
): value is EvaluationResult {
  if (
    !isRecord(value) ||
    value.resultVersion !== ZERO_G_RESULT_VERSION ||
    typeof value.questionId !== "string" ||
    !Number.isInteger(value.confidence) ||
    Number(value.confidence) < 0 ||
    Number(value.confidence) > 100 ||
    !isRecord(value.provenance) ||
    value.provenance.evaluator !== "0g" ||
    value.provenance.teeVerified !== true ||
    value.provenance.requestId !== request.requestId ||
    value.provenance.model !== request.model ||
    value.provenance.provider !== request.provider ||
    !isRecord(value.scoreDefinition) ||
    typeof value.scoreDefinition.zero !== "string" ||
    typeof value.scoreDefinition.oneHundred !== "string" ||
    !isRecord(value.evaluationBasis) ||
    typeof value.evaluationBasis.description !== "string" ||
    typeof value.evaluationBasis.unit !== "string" ||
    typeof value.explanation !== "string" ||
    !isRecord(value.evidence) ||
    !Array.isArray(value.evidence.rowNumbers) ||
    !Array.isArray(value.evidence.aggregateCounts) ||
    !Array.isArray(value.evidence.reasons)
  ) {
    return false;
  }

  if (value.status === "unable") {
    return (
      value.score === null &&
      value.numerator === null &&
      value.denominator === null
    );
  }

  if (
    value.status !== "scored" ||
    !Number.isInteger(value.score) ||
    Number(value.score) < 0 ||
    Number(value.score) > 100
  ) {
    return false;
  }

  if (value.numerator === null && value.denominator === null) {
    return true;
  }

  return (
    Number.isSafeInteger(value.numerator) &&
    Number(value.numerator) >= 0 &&
    Number.isSafeInteger(value.denominator) &&
    Number(value.denominator) > 0 &&
    Number(value.numerator) <= Number(value.denominator) &&
    Math.round(
      (Number(value.numerator) / Number(value.denominator)) * 100,
    ) === value.score
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
