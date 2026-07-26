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
  inferenceRequests: {
    made: number;
    maximum: number;
  };
  results: EvaluationResult[];
  semanticVerification: "not_run" | "verified";
};

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
  budget.assertCanPlan(plannedSemanticRequests);

  const results = await Promise.all(
    contracts.map((contract) =>
      contract.method === "deterministic"
        ? evaluateDeterministicContract(contract, sample)
        : evaluateSemanticContract(contract, sample, {
            requestBudget: budget,
            requestCompletion: options.requestCompletion,
          }),
    ),
  );
  const semanticResults = results.filter(
    (result) => result.evidence.method === "semantic",
  );
  const verifiedSemanticResults = semanticResults.filter(
    (result) => result.evidence.zeroG?.teeVerified === true,
  );

  return {
    inferenceRequests: budget.snapshot(),
    results,
    semanticVerification:
      verifiedSemanticResults.length > 0 ? "verified" : "not_run",
  };
}
