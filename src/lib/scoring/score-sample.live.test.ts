import { describe, expect, it } from "vitest";

import { parseCsvSample } from "../csv/parse-sample";
import { scorePrivateCsvSample } from "./score-sample";

const describeLive =
  process.env.SCORING_LIVE === "1" ? describe : describe.skip;

describeLive("live private question scoring", () => {
  it(
    "returns one verified integer score for every question",
    async () => {
      const questions = [
        {
          id: "q-required-fields",
          text: "Does the sample contain the fields needed to analyze order value by currency?",
        },
        {
          id: "q-recent-orders",
          text: "Is the sample recent enough to inspect orders from the last seven days?",
        },
      ];
      const sample = parseCsvSample(
        new TextEncoder().encode(
          [
            "order_id,order_total,currency,order_date",
            "1001,84.50,EUR,2026-07-22",
            "1002,112.00,EUR,2026-07-23",
            "1003,39.90,GBP,2026-07-24",
          ].join("\n"),
        ),
      );

      const result = await scorePrivateCsvSample(questions, sample);

      expect(result.scores).toHaveLength(questions.length);
      expect(result.scores.map((score) => score.questionId)).toEqual(
        questions.map((question) => question.id),
      );
      for (const score of result.scores) {
        expect(Number.isInteger(score.score)).toBe(true);
        expect(score.score).toBeGreaterThanOrEqual(1);
        expect(score.score).toBeLessThanOrEqual(100);
      }
      expect(result.trace).toMatchObject({ teeVerified: true });
      expect(result.trace.model).toBeTruthy();
      expect(result.trace.provider).toBeTruthy();
      expect(result.trace.requestId).toBeTruthy();
    },
    60_000,
  );
});
