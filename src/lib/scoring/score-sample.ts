import type { ParsedCsvSample } from "../csv/parse-sample";
import { validateGeneratedPlan } from "../evaluation-plans/generate";
import type {
  AnswerableEvaluationPlan,
  GeneratedEvaluationPlan,
  UnableEvaluationPlan,
} from "../evaluation-plans/types";
import type {
  VerifiedCompletion,
  ZeroGMessage,
} from "../zero-g/client";
import {
  getInferenceRequestLimit,
  InferenceRequestBudget,
} from "../zero-g/request-budget";
import { evaluateDeterministicContract } from "./deterministic";
import {
  type EvaluationRunDiagnostics,
  InferenceAuditRecorder,
} from "./run-diagnostics";
import { executionErrorFromFailure } from "./execution-error";
import { evaluateSemanticContract } from "./semantic";
import type { EvaluationResult } from "./types";
import {
  ONE_RECORD_LIMITATION,
  SUBMITTED_DATA_LIMITATION,
} from "./types";

type CompletionRequester = (
  messages: ZeroGMessage[],
) => Promise<VerifiedCompletion>;

type ScoringOptions = {
  maximumInferenceRequests?: number;
  requestCompletion?: CompletionRequester;
};

export type PrivateScoringResult = {
  diagnostics: EvaluationRunDiagnostics;
  inferenceRequests: {
    made: number;
    maximum: number;
  };
  results: EvaluationResult[];
  semanticVerification: "not_run" | "verified";
};

export class PrivateScoringError extends Error {
  constructor(
    readonly diagnostics: EvaluationRunDiagnostics,
    options: ErrorOptions,
  ) {
    super("Private scoring did not complete.", options);
    this.name = "PrivateScoringError";
  }
}

export async function scorePrivateCsvSample(
  plans: GeneratedEvaluationPlan[],
  sample: ParsedCsvSample,
  options: ScoringOptions = {},
): Promise<PrivateScoringResult> {
  if (plans.length < 1) {
    throw new Error("At least one generated evaluation plan is required.");
  }

  for (const plan of plans) {
    const validation = validateGeneratedPlan(
      plan,
      {
        id: plan.questionId,
        question: plan.originalQuestion,
      },
      sample,
    );

    if (!validation.valid) {
      throw new Error(
        "A generated evaluation plan does not match the submitted CSV.",
      );
    }
  }

  const budget = new InferenceRequestBudget(
    options.maximumInferenceRequests ?? getInferenceRequestLimit(),
  );
  const plannedSemanticRequests =
    plans.filter((plan) => plan.method === "semantic")
      .length * 2;
  const recorder = new InferenceAuditRecorder();
  const results: EvaluationResult[] = [];

  try {
    budget.assertCanPlan(plannedSemanticRequests);

    for (const plan of plans) {
      if (plan.status === "unable") {
        results.push(planningUnableResult(plan, sample));
        continue;
      }

      const contract = plan.contract;

      if (contract.method === "deterministic") {
        results.push(evaluateDeterministicContract(contract, sample));
        continue;
      }

      try {
        results.push(
          await evaluateSemanticContract(contract, sample, {
            onCompletion: (pass, completion) =>
              recorder.recordCompletion(
                contract.questionId,
                pass,
                completion,
              ),
            onRequestError: (pass, error) =>
              recorder.recordError(contract.questionId, pass, error),
            requestBudget: budget,
            requestCompletion: options.requestCompletion,
          }),
        );
      } catch (error) {
        results.push(
          semanticExecutionErrorResult(plan, sample, error),
        );
      }
    }
  } catch (error) {
    throw new PrivateScoringError(
      recorder.snapshot(budget.snapshot()),
      { cause: error },
    );
  }
  const semanticResults = results.filter(
    (result) => result.evidence.method === "semantic",
  );
  const verifiedSemanticResults = semanticResults.filter(
    (result) => result.evidence.zeroG?.teeVerified === true,
  );

  return {
    diagnostics: recorder.snapshot(budget.snapshot()),
    inferenceRequests: budget.snapshot(),
    results,
    semanticVerification:
      verifiedSemanticResults.length > 0 ? "verified" : "not_run",
  };
}

function semanticExecutionErrorResult(
  plan: AnswerableEvaluationPlan,
  sample: ParsedCsvSample,
  error: unknown,
): EvaluationResult {
  return {
    error: executionErrorFromFailure(error),
    evidence: {
      agreement: {
        ratio: null,
        requiredRatio: null,
        status: "not_applicable",
      },
      contractVersion: plan.contract.contractVersion,
      controlCheck: "not_applicable",
      coverageRatio: null,
      limitation:
        sample.rowCount === 1
          ? ONE_RECORD_LIMITATION
          : SUBMITTED_DATA_LIMITATION,
      measurement: null,
      method: "semantic",
      recordsEvaluated: null,
      recordsSubmitted: sample.rowCount,
      semanticFailure: null,
      zeroG: null,
    },
    questionId: plan.questionId,
    score: null,
    status: "error",
  };
}

function planningUnableResult(
  plan: UnableEvaluationPlan,
  sample: ParsedCsvSample,
): EvaluationResult {
  return {
    evidence: {
      agreement: {
        ratio: null,
        requiredRatio: null,
        status: "not_applicable",
      },
      contractVersion: plan.planVersion,
      controlCheck: "not_applicable",
      coverageRatio: 0,
      limitation:
        sample.rowCount === 1
          ? ONE_RECORD_LIMITATION
          : SUBMITTED_DATA_LIMITATION,
      measurement: null,
      method: "unable",
      recordsEvaluated: 0,
      recordsSubmitted: sample.rowCount,
      semanticFailure: null,
      zeroG: null,
    },
    questionId: plan.questionId,
    reason: plan.unableReason,
    score: null,
    status: "unable_to_score",
  };
}
