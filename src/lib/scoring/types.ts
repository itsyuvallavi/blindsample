import type { EvaluationContract } from "../evaluation-contracts/types";
import type { ZeroGTrace } from "../zero-g/client";

export const SUBMITTED_DATA_LIMITATION =
  "This result describes only the submitted records. BlindSample cannot prove that they represent the seller's complete dataset.";

export const ONE_RECORD_LIMITATION =
  "Only one submitted record was evaluated, so coverage is extremely limited. BlindSample cannot prove that it represents the seller's complete dataset.";

export type UnableToScoreReason =
  | "control_check_failed"
  | "insufficient_coverage"
  | "insufficient_records"
  | "invalid_semantic_output"
  | "missing_required_columns"
  | "unstable_classification";

export type ResultEvidence = {
  agreement: {
    ratio: number | null;
    requiredRatio: number | null;
    status: "failed" | "not_applicable" | "passed";
  };
  contractVersion: EvaluationContract["contractVersion"];
  controlCheck: "failed" | "not_applicable" | "passed";
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
  zeroG: {
    model: string;
    provider: string;
    requestIds: string[];
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
    model: first.model,
    provider: first.provider,
    requestIds: traces.map((trace) => trace.requestId),
    teeVerified: true as const,
  };
}
