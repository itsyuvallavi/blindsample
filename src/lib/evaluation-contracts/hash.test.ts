import { describe, expect, it } from "vitest";

import { hashEvaluationQuestions } from "./hash";

const QUESTIONS = [
  {
    id: "relevance",
    question: "Is this relevant?",
  },
];

describe("hashEvaluationQuestions", () => {
  it("binds approval to the exact plain-language question set", () => {
    expect(hashEvaluationQuestions(QUESTIONS)).toBe(
      hashEvaluationQuestions([...QUESTIONS]),
    );
    expect(
      hashEvaluationQuestions([
        { ...QUESTIONS[0], question: "Is this complete?" },
      ]),
    ).not.toBe(hashEvaluationQuestions(QUESTIONS));
    expect(hashEvaluationQuestions(QUESTIONS)).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });
});
