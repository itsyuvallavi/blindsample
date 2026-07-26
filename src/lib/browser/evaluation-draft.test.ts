import { describe, expect, it } from "vitest";

import {
  parseEvaluationDraft,
  serializeEvaluationDraft,
} from "./evaluation-draft";

describe("evaluation draft storage", () => {
  it("round-trips only the evaluation name and plain-text questions", () => {
    const draft = {
      questions: [
        {
          id: "btc_context",
          question: "Does each market context explain the BTC movement?",
        },
      ],
      title: "BTC sample",
    };

    expect(
      parseEvaluationDraft(serializeEvaluationDraft(draft)),
    ).toEqual(draft);
  });

  it("preserves structurally valid unfinished text fields", () => {
    expect(
      parseEvaluationDraft(
        serializeEvaluationDraft({
          questions: [{ id: "question_1", question: "" }],
          title: "",
        }),
      ),
    ).not.toBeNull();
  });

  it.each([
    null,
    "",
    "not-json",
    JSON.stringify({ version: 1 }),
    JSON.stringify({
      questions: [
        {
          columns: ["message"],
          id: "unsafe",
          question: "Question",
        },
      ],
      title: "Invalid",
      version: 2,
    }),
  ])("rejects invalid or technical stored data", (serialized) => {
    expect(parseEvaluationDraft(serialized)).toBeNull();
  });
});
