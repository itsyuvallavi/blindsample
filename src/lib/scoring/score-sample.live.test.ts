import { describe, expect, it } from "vitest";

import { parseCsvSample } from "../samples/parse-csv";
import { paidLiveEnabled } from "../testing/paid-live";
import { scorePrivateCsvSample } from "./score-sample";

const describeLive = paidLiveEnabled("SCORING_LIVE")
  ? describe
  : describe.skip;

describeLive("one-request 0G scoring", () => {
  it(
    "returns one verified result for every question",
    async () => {
      const sample = parseCsvSample(
        new TextEncoder().encode(
          [
            "message",
            "A customer asks for help with an account.",
            "A customer asks for help with a payment.",
          ].join("\n"),
        ),
      );
      const questions = [
        {
          id: "complete",
          question:
            "What percentage of records contain a message value?",
        },
        {
          id: "relevance",
          question:
            "Does each message describe a request requiring support?",
        },
      ];

      const result = await scorePrivateCsvSample({
        evaluationId: "live-scoring-check",
        questions,
        sample,
      });

      expect(result.inferenceRequests).toEqual({
        made: 1,
        maximum: 1,
      });
      expect(result.results).toHaveLength(questions.length);
      expect(
        result.results.map((item) => item.questionId),
      ).toEqual(questions.map((question) => question.id));
      expect(
        result.results.every(
          (item) =>
            item.provenance.evaluator === "0g" &&
            item.provenance.teeVerified,
        ),
      ).toBe(true);

      console.info(
        JSON.stringify({
          diagnostics: result.diagnostics,
          questionResults: result.results.map((item) => ({
            questionId: item.questionId,
            score: item.score,
            status: item.status,
          })),
        }),
      );
    },
    60_000,
  );
});
