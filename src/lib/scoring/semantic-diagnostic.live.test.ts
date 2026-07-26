import { describe, expect, it } from "vitest";

import { compileEvaluationContracts } from "../evaluation-contracts/compile";
import { paidLiveEnabled } from "../testing/paid-live";
import {
  createLiveSemanticSample,
  LIVE_SEMANTIC_CRITERION,
} from "../testing/semantic-live-fixture";
import { runOriginalSemanticDiagnostic } from "../testing/original-semantic-diagnostic";
import {
  getZeroGConfig,
  requestVerifiedPrivateCompletion,
} from "../zero-g/client";
import {
  prepareSemanticRecords,
  semanticOutputTokenLimit,
} from "./semantic";

const describeLive = paidLiveEnabled("SEMANTIC_DIAGNOSTIC_LIVE")
  ? describe
  : describe.skip;

describeLive("one-request semantic diagnostic", () => {
  it(
    "prints sanitized original-pass evidence before validating it",
    async () => {
      const contract = compileEvaluationContracts([
        LIVE_SEMANTIC_CRITERION,
      ])[0];
      const sample = createLiveSemanticSample();
      const config = getZeroGConfig({
        ...process.env,
        ZERO_G_API_KEY: process.env.MAIN_ZERO_G_API_KEY,
      });
      const records = prepareSemanticRecords(contract, sample);
      const diagnostic = await runOriginalSemanticDiagnostic(
        contract,
        sample,
        (messages) =>
          requestVerifiedPrivateCompletion(messages, {
            config,
            disableThinking: true,
            maxTokens: semanticOutputTokenLimit(records.length),
            responseFormat: "json_object",
          }),
      );

      console.info(JSON.stringify(diagnostic));
      expect(diagnostic.inferenceRequests).toEqual({
        made: 1,
        maximum: 1,
      });
      expect(diagnostic.requests).toHaveLength(1);
      expect(diagnostic.requests[0]).toMatchObject({
        attempt: 1,
        pass: "original",
        teeVerified: true,
      });
      expect(diagnostic.status).toBe("parsed");
      expect(diagnostic.jsonModeRespected).toBe(true);
      expect(diagnostic.strictSchemaParsed).toBe(true);
      expect(diagnostic.semanticFailure).toBeNull();
      expect(diagnostic.controlCheck).toBe("passed");
      expect(diagnostic.classificationCount).toEqual({
        expected: records.length,
        received: records.length,
      });
    },
    90_000,
  );
});
