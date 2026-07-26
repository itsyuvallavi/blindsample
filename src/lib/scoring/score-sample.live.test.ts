import { describe, expect, it } from "vitest";

import { compileEvaluationContracts } from "../evaluation-contracts/compile";
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

      const result = await scorePrivateCsvSample(contracts, sample, {
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
