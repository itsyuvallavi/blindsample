import type { EvaluationContract } from "../evaluation-contracts/types";
import type { ZeroGTrace } from "../zero-g/client";
import type { RubricLabel } from "./semantic-output";

export const SUBMITTED_DATA_LIMITATION =
  "This result describes only the submitted records. BlindSample cannot prove that they represent the seller's complete dataset.";

export const ONE_RECORD_LIMITATION =
  "Only one submitted record was evaluated, so coverage is extremely limited. BlindSample cannot prove that it represents the seller's complete dataset.";

export type UnableToScoreReason =
  | "control_check_failed"
  | "insufficient_coverage"
  | "insufficient_records"
  | "missing_required_columns"
  | "semantic_output_empty"
  | "semantic_output_invalid_json"
  | "semantic_output_invalid_shape"
  | "semantic_output_truncated"
  | "unstable_classification";

export type SemanticOutputFailure = {
  kind: "empty" | "invalid_json" | "invalid_shape" | "truncated";
  pass: "original" | "repeat";
};

export type SemanticControlClassification = {
  controlId: string;
  expectedLabel: RubricLabel;
  originalLabel: RubricLabel;
  repeatedLabel: RubricLabel;
};

export type ResultEvidence = {
  agreement: {
    ratio: number | null;
    requiredRatio: number | null;
    status: "failed" | "not_applicable" | "passed";
  };
  contractVersion: EvaluationContract["contractVersion"];
  controlCheck: "failed" | "not_applicable" | "passed";
  controlClassifications?: SemanticControlClassification[];
  coverageRatio: number;
  limitation: string;
  measurement: {
    name: string;
    unit: "percent" | "rubric_points";
    value: number;
  } | null;
  method: EvaluationContract["method"];
  recordsEvaluated: number;
  recordsSubmitted: number;
  semanticFailure: SemanticOutputFailure | null;
  zeroG: {
    requests: ZeroGTrace[];
    teeVerified: true;
  } | null;
};

export type ScoredEvaluationResult = {
  evidence: ResultEvidence;
  questionId: string;
  score: number;
  status: "scored";
};

export type UnableEvaluationResult = {
  evidence: ResultEvidence;
  questionId: string;
  reason: UnableToScoreReason;
  score: null;
  status: "unable_to_score";
};

export type EvaluationResult =
  | ScoredEvaluationResult
  | UnableEvaluationResult;

export function zeroGEvidence(traces: ZeroGTrace[]) {
  const first = traces[0];

  if (!first || traces.some((trace) => trace.teeVerified !== true)) {
    throw new Error("Verified 0G traces are required.");
  }

  return {
    requests: traces,
    teeVerified: true as const,
  };
}
