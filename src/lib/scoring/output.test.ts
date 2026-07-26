import { describe, expect, it } from "vitest";

import type { EvaluationQuestion } from "../supabase/evaluations";
import { parseScoringOutput, ScoringOutputError } from "./output";

const QUESTIONS: EvaluationQuestion[] = [
  { id: "q-complete", text: "Is the sample complete?" },
  { id: "q-current", text: "Is the sample current?" },
];

describe("parseScoringOutput", () => {
  it("returns exact scores in the buyer's question order", () => {
    expect(
      parseScoringOutput(
        JSON.stringify({
          scores: [
            { questionId: "q-current", score: 72 },
            { questionId: "q-complete", score: 91 },
          ],
        }),
        QUESTIONS,
      ),
    ).toEqual([
      { questionId: "q-complete", score: 91 },
      { questionId: "q-current", score: 72 },
    ]);
  });

  it.each([
    ["markdown", '```json\n{"scores":[]}\n```'],
    [
      "missing score",
      JSON.stringify({
        scores: [{ questionId: "q-complete", score: 91 }],
      }),
    ],
    [
      "duplicate ID",
      JSON.stringify({
        scores: [
          { questionId: "q-complete", score: 91 },
          { questionId: "q-complete", score: 72 },
        ],
      }),
    ],
    [
      "extra ID",
      JSON.stringify({
        scores: [
          { questionId: "q-complete", score: 91 },
          { questionId: "q-extra", score: 72 },
        ],
      }),
    ],
    [
      "decimal",
      JSON.stringify({
        scores: [
          { questionId: "q-complete", score: 91.5 },
          { questionId: "q-current", score: 72 },
        ],
      }),
    ],
    [
      "out of range",
      JSON.stringify({
        scores: [
          { questionId: "q-complete", score: 101 },
          { questionId: "q-current", score: 72 },
        ],
      }),
    ],
    [
      "overall score",
      JSON.stringify({
        overallScore: 82,
        scores: [
          { questionId: "q-complete", score: 91 },
          { questionId: "q-current", score: 72 },
        ],
      }),
    ],
    [
      "explanation",
      JSON.stringify({
        scores: [
          {
            explanation: "Looks good",
            questionId: "q-complete",
            score: 91,
          },
          { questionId: "q-current", score: 72 },
        ],
      }),
    ],
  ])("rejects %s output", (_label, content) => {
    expect(() => parseScoringOutput(content, QUESTIONS)).toThrowError(
      ScoringOutputError,
    );
  });
});
