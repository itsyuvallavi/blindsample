import { describe, expect, it } from "vitest";

import { createDefaultSemanticCriterion } from "../evaluation-contracts/default-semantic";
import {
  parseEvaluationDraft,
  serializeEvaluationDraft,
} from "./evaluation-draft";

describe("evaluation draft storage", () => {
  it("round-trips editable fields and semantic review fingerprints", () => {
    const draft = {
      criteria: [createDefaultSemanticCriterion("support")],
      semanticReviewFingerprints: {
        support: "reviewed-fingerprint",
      },
      title: "Support sample",
    };

    expect(
      parseEvaluationDraft(serializeEvaluationDraft(draft)),
    ).toEqual(draft);
  });

  it("preserves structurally valid unfinished text fields", () => {
    const criterion = createDefaultSemanticCriterion("support");

    expect(
      parseEvaluationDraft(
        serializeEvaluationDraft({
          criteria: [
            {
              ...criterion,
              controls: { ...criterion.controls, positive: "" },
              target: "",
            },
          ],
          semanticReviewFingerprints: {},
          title: "",
        }),
      ),
    ).not.toBeNull();
  });

  it.each([
    null,
    "",
    "not-json",
    JSON.stringify({ version: 2 }),
    JSON.stringify({
      criteria: [{ id: "unsafe", kind: "unknown", question: "?" }],
      semanticReviewFingerprints: {},
      title: "Invalid",
      version: 1,
    }),
  ])("rejects invalid or unsupported stored data", (serialized) => {
    expect(parseEvaluationDraft(serialized)).toBeNull();
  });
});
