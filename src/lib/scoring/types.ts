import type { EvaluationContract } from "../evaluation-contracts/types";
import { EVALUATION_PLAN_VERSION } from "../evaluation-plans/types";
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
  | "ambiguous_question"
  | "information_not_present"
  | "invalid_generated_plan"
  | "missing_required_columns"
  | "model_or_verification_failed"
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
  contractVersion:
    | EvaluationContract["contractVersion"]
    | typeof EVALUATION_PLAN_VERSION;
  controlCheck: "failed" | "not_applicable" | "passed";
  controlClassifications?: SemanticControlClassification[];
  coverageRatio: number;
  limitation: string;
  measurement: {
    name: string;
    unit: "percent" | "rubric_points";
    value: number;
  } | null;
  method: EvaluationContract["method"] | "unable";
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

export function unableReasonExplanation(reason: UnableToScoreReason) {
  switch (reason) {
    case "ambiguous_question":
      return "The question was too ambiguous to interpret safely. No score was attempted.";
    case "information_not_present":
      return "The submitted CSV did not contain the information needed to answer this question.";
    case "invalid_generated_plan":
      return "BlindSample could not create a safe plan from the submitted headers. No score was attempted.";
    case "missing_required_columns":
      return "The submitted CSV did not contain every field required by the evaluation plan.";
    case "insufficient_coverage":
      return "Too few submitted records contained usable evidence for a reliable score.";
    case "insufficient_records":
      return "The submitted sample did not contain enough usable records for a reliable score.";
    case "control_check_failed":
      return "The private model did not classify the internal reliability checks consistently.";
    case "unstable_classification":
      return "Repeated private evaluations did not agree closely enough to publish a score.";
    case "model_or_verification_failed":
      return "The private model request or its verification failed, so no score was published.";
    case "semantic_output_empty":
      return "The private model returned no usable classifications.";
    case "semantic_output_invalid_json":
    case "semantic_output_invalid_shape":
      return "The private model response could not be safely parsed into record-level judgments.";
    case "semantic_output_truncated":
      return "The private model response ended before all record-level judgments were returned.";
  }
}
