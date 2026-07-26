import type { ParsedCsvSample } from "../csv/parse-sample";
import type { EvaluationContract } from "../evaluation-contracts/types";
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
import { evaluateSemanticContract } from "./semantic";
import type { EvaluationResult } from "./types";

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
  contracts: EvaluationContract[],
  sample: ParsedCsvSample,
  options: ScoringOptions = {},
): Promise<PrivateScoringResult> {
  if (
    contracts.length < 1 ||
    !contracts.some((contract) => contract.method === "semantic")
  ) {
    throw new Error(
      "The 0G MVP requires at least one semantic evaluation contract.",
    );
  }

  const budget = new InferenceRequestBudget(
    options.maximumInferenceRequests ?? getInferenceRequestLimit(),
  );
  const plannedSemanticRequests =
    contracts.filter((contract) => contract.method === "semantic")
      .length * 2;
  const recorder = new InferenceAuditRecorder();
  const results: EvaluationResult[] = [];

  try {
    budget.assertCanPlan(plannedSemanticRequests);

    for (const contract of contracts) {
      results.push(
        contract.method === "deterministic"
          ? evaluateDeterministicContract(contract, sample)
          : await evaluateSemanticContract(contract, sample, {
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
