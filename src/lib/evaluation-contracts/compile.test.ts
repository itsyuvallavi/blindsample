import { describe, expect, it } from "vitest";

import { compileEvaluationContracts } from "./compile";
import type { CriterionDraft } from "./types";

const SEMANTIC_DRAFT: CriterionDraft = {
  columns: ["description"],
  controls: {
    intermediate: "A customer asks a general product question.",
    negative: "A weather report with no customer support content.",
    positive: "A customer reports a billing error and asks for help.",
  },
  id: "support_relevance",
  kind: "semantic_relevance",
  question: "Is this useful for a customer support classifier?",
  target: "Customer support requests that require an agent response.",
};

describe("compileEvaluationContracts", () => {
  it("creates a complete versioned semantic evaluation contract", () => {
    const [contract] = compileEvaluationContracts([SEMANTIC_DRAFT]);

    expect(contract).toMatchObject({
      aggregationMethod: "server_mean_rubric_points",
      contractVersion: "1.0.0",
      method: "semantic",
      minimumEvidence: {
        coverageRatio: 0.8,
        records: 3,
      },
      originalQuestion:
        "Is this useful for a customer support classifier?",
      populationRule: "all_submitted_records_no_sampling",
      questionId: "support_relevance",
      requiredColumns: ["description"],
    });
    expect(contract?.normalizedCriterion).toContain(
      "Customer support requests",
    );
    expect(Object.keys(contract?.scoringAnchors ?? {})).toEqual([
      "1",
      "25",
      "50",
      "75",
      "100",
    ]);
    expect(contract?.requiredEvidence.length).toBeGreaterThan(0);
    expect(contract?.unableToScoreConditions).toEqual(
      expect.arrayContaining([
        expect.stringContaining("agreement"),
        expect.stringContaining("TEE"),
      ]),
    );
  });

  it.each<CriterionDraft>([
    {
      columns: ["email", "phone"],
      id: "complete",
      kind: "completeness",
      question: "Are contact fields complete?",
    },
    {
      column: "email",
      format: "email",
      id: "format",
      kind: "format_validity",
      question: "Are emails valid?",
    },
    {
      column: "customer_id",
      id: "unique",
      kind: "uniqueness",
      question: "Are customer IDs unique?",
    },
    {
      column: "created_at",
      id: "fresh",
      kind: "date_freshness",
      maximumAgeDays: 30,
      question: "Are records recent?",
      referenceDate: "2026-07-26",
    },
    {
      column: "price",
      id: "range",
      kind: "numeric_range",
      maximum: 100,
      minimum: 0,
      question: "Are prices in range?",
    },
    {
      columns: ["id", "label"],
      id: "columns",
      kind: "column_availability",
      question: "Are required columns present?",
    },
    {
      column: "region",
      expectedValues: ["north", "south"],
      id: "coverage",
      kind: "category_coverage",
      question: "Are both regions represented?",
    },
  ])(
    "compiles the $kind objective metric without model arithmetic",
    (draft) => {
      const [contract] = compileEvaluationContracts([draft], {
        requireSemantic: false,
      });

      expect(contract).toMatchObject({
        aggregationMethod: "server_percentage_to_score",
        contractVersion: "1.0.0",
        method: "deterministic",
        questionId: draft.id,
      });
    },
  );

  it("rejects an all-deterministic evaluation for the 0G MVP", () => {
    expect(() =>
      compileEvaluationContracts([
        {
          columns: ["id"],
          id: "columns",
          kind: "column_availability",
          question: "Is the ID column present?",
        },
      ]),
    ).toThrow("at least one semantic relevance criterion");
  });

  it("requests clarification instead of pretending vague input is measurable", () => {
    expect(() =>
      compileEvaluationContracts([
        {
          id: "vague",
          kind: "semantic_relevance",
          question: "Is this good?",
        },
      ]),
    ).toThrow("needs clarification");
  });

  it("rejects invalid ranges and duplicate controls", () => {
    expect(() =>
      compileEvaluationContracts(
        [
          {
            column: "price",
            id: "range",
            kind: "numeric_range",
            maximum: 10,
            minimum: 20,
            question: "Are prices in range?",
          },
        ],
        { requireSemantic: false },
      ),
    ).toThrow("maximum greater than the minimum");

    expect(() =>
      compileEvaluationContracts([
        {
          ...SEMANTIC_DRAFT,
          controls: {
            intermediate: "same",
            negative: "same",
            positive: "same",
          },
        },
      ]),
    ).toThrow("three distinct control examples");
  });
});
