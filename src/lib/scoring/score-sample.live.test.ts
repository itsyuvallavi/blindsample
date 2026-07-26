import { describe, expect, it } from "vitest";

import { parseCsvSample } from "../csv/parse-sample";
import { compileEvaluationContracts } from "../evaluation-contracts/compile";
import { scorePrivateCsvSample } from "./score-sample";

const describeLive =
  process.env.SCORING_LIVE === "1" ? describe : describe.skip;

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
        {
          columns: ["message"],
          controls: {
            intermediate:
              "Could you tell me more about your subscription options?",
            negative:
              "Today will be sunny with a light wind from the west.",
            positive:
              "My account is locked and I need an agent to restore access.",
          },
          id: "support_relevance",
          kind: "semantic_relevance",
          question:
            "Are these useful examples of customer requests needing support?",
          target:
            "Customer requests that require a support agent to take action.",
        },
      ]);
      const sample = parseCsvSample(
        new TextEncoder().encode(
          [
            "message",
            "My invoice has the wrong amount.",
            "Please help me reset my account password.",
            "I need a refund for a duplicate charge.",
            "The dashboard will not load.",
            "Please update the email on my account.",
          ].join("\n"),
        ),
      );

      const result = await scorePrivateCsvSample(contracts, sample);
      const semantic = result.results.find(
        (item) => item.questionId === "support_relevance",
      );

      expect(result.results).toHaveLength(contracts.length);
      expect(result.semanticVerification).toBe("verified");
      expect(semantic?.evidence.zeroG?.teeVerified).toBe(true);
      expect(semantic?.evidence.zeroG?.requests).toHaveLength(2);
      for (const request of semantic?.evidence.zeroG?.requests ?? []) {
        expect(request.model).toBeTruthy();
        expect(request.provider).toBeTruthy();
        expect(request.requestId).toBeTruthy();
      }
    },
    90_000,
  );
});
