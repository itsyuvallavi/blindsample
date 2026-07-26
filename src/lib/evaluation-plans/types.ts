import type { EvaluationContract } from "../evaluation-contracts/types";

export const EVALUATION_PLAN_VERSION = "2.0.0" as const;

export type EvaluationQuestion = {
  id: string;
  question: string;
};

export type PlanningUnableReason =
  | "ambiguous_question"
  | "information_not_present"
  | "invalid_generated_plan";

type EvaluationPlanBase = {
  confidence: number;
  datasetFingerprint: string;
  evidenceNeeded: string[];
  generationAttempt: 1 | 2;
  originalQuestion: string;
  planVersion: typeof EVALUATION_PLAN_VERSION;
  questionFingerprint: string;
  questionId: string;
  relevantColumns: string[];
  scoreMeaning: {
    one: string;
    oneHundred: string;
  };
};

export type AnswerableEvaluationPlan = EvaluationPlanBase & {
  contract: EvaluationContract;
  explanation: string;
  method: "deterministic" | "semantic";
  status: "answerable";
  unableReason: null;
};

export type UnableEvaluationPlan = EvaluationPlanBase & {
  contract: null;
  explanation: string;
  method: "unable";
  status: "unable";
  unableReason: PlanningUnableReason;
};

export type GeneratedEvaluationPlan =
  | AnswerableEvaluationPlan
  | UnableEvaluationPlan;

export type PlanValidation =
  | { valid: true }
  | {
      missingColumns: string[];
      reason:
        | "dataset_changed"
        | "invalid_contract"
        | "missing_columns"
        | "question_changed";
      valid: false;
    };
