import type { ParsedCsvSample } from "../csv/parse-sample";
import type { EvaluationContract } from "../evaluation-contracts/types";
import type {
  VerifiedCompletion,
  ZeroGMessage,
} from "../zero-g/client";
import { evaluateDeterministicContract } from "./deterministic";
import { evaluateSemanticContract } from "./semantic";
import type { EvaluationResult } from "./types";

type CompletionRequester = (
  messages: ZeroGMessage[],
) => Promise<VerifiedCompletion>;

type ScoringOptions = {
  requestCompletion?: CompletionRequester;
};

export type PrivateScoringResult = {
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

  const results = await Promise.all(
    contracts.map((contract) =>
      contract.method === "deterministic"
        ? evaluateDeterministicContract(contract, sample)
        : evaluateSemanticContract(contract, sample, {
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
    results,
    semanticVerification:
      verifiedSemanticResults.length > 0 ? "verified" : "not_run",
  };
}
