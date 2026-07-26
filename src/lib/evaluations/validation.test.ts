import { describe, expect, it } from "vitest";

import { PRODUCT_LIMITS } from "../product-contract";
import {
  EvaluationInputError,
  validateContractPreviewDraft,
  validateEvaluationDraft,
} from "./validation";

const CRITERIA = [
  {
    columns: ["message"],
    controls: {
      intermediate: "A general product question.",
      negative: "A weather report unrelated to support.",
      positive: "A customer asks an agent to restore account access.",
    },
    id: "relevance",
    kind: "semantic_relevance",
    question: "Is this useful for support classification?",
    target: "Customer requests requiring a support agent response.",
  },
] as const;

describe("evaluation input validation", () => {
  it("binds activation to the exact buyer-reviewed contracts", () => {
    const preview = validateContractPreviewDraft({
      criteria: CRITERIA,
    });

    expect(
      validateEvaluationDraft({
        approvedContractSetHash: preview.contractSetHash,
        criteria: CRITERIA,
        title: "  Support data  ",
      }),
    ).toEqual({
      contracts: preview.contracts,
      contractSetHash: preview.contractSetHash,
      title: "Support data",
    });
  });

  it("rejects activation when criteria change after review", () => {
    const preview = validateContractPreviewDraft({
      criteria: CRITERIA,
    });

    expect(() =>
      validateEvaluationDraft({
        approvedContractSetHash: preview.contractSetHash,
        criteria: [
          {
            ...CRITERIA[0],
            target: "A materially different target requiring new approval.",
          },
        ],
        title: "Support data",
      }),
    ).toThrow("changed after contract review");
  });

  it("rejects extra fields and duplicate criterion IDs", () => {
    expect(() =>
      validateContractPreviewDraft({
        criteria: CRITERIA,
        overallScore: true,
      }),
    ).toThrowError(EvaluationInputError);

    expect(() =>
      validateContractPreviewDraft({
        criteria: [CRITERIA[0], CRITERIA[0]],
      }),
    ).toThrow("unique");
  });

  it("enforces criterion count and question text limits", () => {
    expect(() =>
      validateContractPreviewDraft({ criteria: [] }),
    ).toThrow("between 1");
    expect(() =>
      validateContractPreviewDraft({
        criteria: Array.from(
          { length: PRODUCT_LIMITS.maximumQuestions + 1 },
          (_, index) => ({
            ...CRITERIA[0],
            id: `q${index}`,
          }),
        ),
      }),
    ).toThrow("between 1");
    expect(() =>
      validateContractPreviewDraft({
        criteria: [
          {
            ...CRITERIA[0],
            question: "x".repeat(
              PRODUCT_LIMITS.maximumQuestionCharacters + 1,
            ),
          },
        ],
      }),
    ).toThrow("characters");
  });

  it("returns clarification_required for incomplete criteria", () => {
    expect(() =>
      validateContractPreviewDraft({
        criteria: [
          {
            id: "vague",
            kind: "semantic_relevance",
            question: "Is this good?",
          },
        ],
      }),
    ).toThrow("needs clarification");
  });
});
