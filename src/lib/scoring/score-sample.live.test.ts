import { describe, expect, it } from "vitest";

import { compileEvaluationContracts } from "../evaluation-contracts/compile";
import {
  fingerprintQuestion,
  fingerprintSample,
} from "../evaluation-plans/generate";
import {
  EVALUATION_PLAN_VERSION,
  type GeneratedEvaluationPlan,
} from "../evaluation-plans/types";
import { buildLiveSemanticSummary } from "../testing/live-semantic-summary";
import { paidLiveEnabled } from "../testing/paid-live";
import {
  createLiveSemanticSample,
  LIVE_SEMANTIC_CRITERION,
} from "../testing/semantic-live-fixture";
import { scorePrivateCsvSample } from "./score-sample";

const describeLive =
  paidLiveEnabled("SCORING_LIVE") ? describe : describe.skip;

describeLive("live defensible private evaluation", () => {
  it(
    "returns contract-level results with verified semantic traces",
    async () => {
      const contracts = compileEvaluationContracts([
        {
          columns: ["message"],
          id: "available",
          kind: "column_availability",
          question: "Is the message field available?",
        },
        LIVE_SEMANTIC_CRITERION,
      ]);
      const sample = createLiveSemanticSample();
      const plans: GeneratedEvaluationPlan[] = contracts.map(
        (contract) => ({
          confidence: 1,
          contract,
          datasetFingerprint: fingerprintSample(sample),
          evidenceNeeded: contract.requiredEvidence,
          explanation: "Live plan bound to the submitted sample.",
          generationAttempt: 1,
          method: contract.method,
          originalQuestion: contract.originalQuestion,
          planVersion: EVALUATION_PLAN_VERSION,
          questionFingerprint: fingerprintQuestion({
            id: contract.questionId,
            question: contract.originalQuestion,
          }),
          questionId: contract.questionId,
          relevantColumns: contract.requiredColumns,
          scoreMeaning: {
            one: contract.scoringAnchors["1"],
            oneHundred: contract.scoringAnchors["100"],
          },
          status: "answerable",
          unableReason: null,
        }),
      );

      const result = await scorePrivateCsvSample(plans, sample, {
        maximumInferenceRequests: 2,
      });
      const semantic = result.results.find(
        (item) => item.questionId === "support_relevance",
      );
      const summary = buildLiveSemanticSummary(
        result,
        "support_relevance",
      );

      console.info(JSON.stringify(summary));
      expect(result.results).toHaveLength(contracts.length);
      expect(result.inferenceRequests).toEqual({
        made: 2,
        maximum: 2,
      });
      expect(result.semanticVerification).toBe("verified");
      expect(semantic?.status).toBe("scored");
      expect(semantic?.score).toEqual(expect.any(Number));
      expect(semantic?.evidence.zeroG?.teeVerified).toBe(true);
      expect(semantic?.evidence.zeroG?.requests).toHaveLength(2);
      expect(result.diagnostics.requests).toHaveLength(2);
      for (const request of semantic?.evidence.zeroG?.requests ?? []) {
        expect(request.model).toBeTruthy();
        expect(request.provider).toBeTruthy();
        expect(request.requestId).toBeTruthy();
      }
    },
    90_000,
  );
});
