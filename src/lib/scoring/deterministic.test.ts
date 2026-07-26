import { describe, expect, it } from "vitest";

import type { ParsedCsvSample } from "../csv/parse-sample";
import { compileEvaluationContracts } from "../evaluation-contracts/compile";
import type { CriterionDraft } from "../evaluation-contracts/types";
import { evaluateDeterministicContract } from "./deterministic";

const SAMPLE: ParsedCsvSample = {
  columnCount: 6,
  columns: [
    "id",
    "email",
    "created_at",
    "price",
    "region",
    "note",
  ],
  rowCount: 4,
  rows: [
    [
      "1",
      "one@example.com",
      "2026-07-25",
      "10",
      "north",
      "alpha",
    ],
    [
      "2",
      "invalid",
      "2026-07-10",
      "20",
      "south",
      "beta",
    ],
    [
      "2",
      "three@example.com",
      "2026-05-01",
      "200",
      "north",
      "",
    ],
    [
      "4",
      "four@example.com",
      "2026-01-01",
      "40",
      "north",
      "delta",
    ],
  ],
};

function contract(draft: CriterionDraft) {
  return compileEvaluationContracts([draft], {
    requireSemantic: false,
  })[0];
}

describe("evaluateDeterministicContract", () => {
  it("calculates mathematically known objective fixtures", () => {
    const fixtures: [CriterionDraft, number, string, number][] = [
      [
        {
          columns: ["id", "note"],
          id: "complete",
          kind: "completeness",
          question: "Are the fields complete?",
        },
        88,
        "completeness_rate",
        87.5,
      ],
      [
        {
          column: "email",
          format: "email",
          id: "format",
          kind: "format_validity",
          question: "Are emails valid?",
        },
        75,
        "format_validity_rate",
        75,
      ],
      [
        {
          column: "id",
          id: "unique",
          kind: "uniqueness",
          question: "Are IDs unique?",
        },
        75,
        "uniqueness_rate",
        75,
      ],
      [
        {
          column: "created_at",
          id: "fresh",
          kind: "date_freshness",
          maximumAgeDays: 30,
          question: "Are dates fresh?",
          referenceDate: "2026-07-26",
        },
        50,
        "date_freshness_rate",
        50,
      ],
      [
        {
          column: "price",
          id: "range",
          kind: "numeric_range",
          maximum: 100,
          minimum: 0,
          question: "Are prices in range?",
        },
        75,
        "numeric_range_rate",
        75,
      ],
      [
        {
          columns: ["id", "label"],
          id: "columns",
          kind: "column_availability",
          question: "Are both columns present?",
        },
        50,
        "column_availability_rate",
        50,
      ],
      [
        {
          column: "region",
          expectedValues: ["north", "south", "east", "west"],
          id: "coverage",
          kind: "category_coverage",
          question: "Are expected regions covered?",
        },
        50,
        "category_coverage_rate",
        50,
      ],
    ];

    for (const [draft, score, name, measurement] of fixtures) {
      const result = evaluateDeterministicContract(
        contract(draft),
        SAMPLE,
      );

      expect(result).toMatchObject({
        evidence: {
          measurement: { name, unit: "percent", value: measurement },
          method: "deterministic",
          recordsSubmitted: 4,
          zeroG: null,
        },
        questionId: draft.id,
        score,
        status: "scored",
      });
      expect(result).not.toHaveProperty("overallScore");
    }
  });

  it("returns unable_to_score when required evidence is missing", () => {
    const result = evaluateDeterministicContract(
      contract({
        column: "missing_price",
        id: "range",
        kind: "numeric_range",
        maximum: 100,
        minimum: 0,
        question: "Are prices in range?",
      }),
      SAMPLE,
    );

    expect(result).toMatchObject({
      reason: "missing_required_columns",
      score: null,
      status: "unable_to_score",
    });
  });

  it("does not fabricate a number when evidence coverage is too low", () => {
    const sparse: ParsedCsvSample = {
      columnCount: 1,
      columns: ["price"],
      rowCount: 5,
      rows: [["10"], [""], [""], [""], [""]],
    };
    const result = evaluateDeterministicContract(
      contract({
        column: "price",
        id: "range",
        kind: "numeric_range",
        maximum: 100,
        minimum: 0,
        question: "Are prices in range?",
      }),
      sparse,
    );

    expect(result).toMatchObject({
      reason: "insufficient_coverage",
      score: null,
      status: "unable_to_score",
    });
  });

  it("discloses extremely limited one-record coverage", () => {
    const oneRecord: ParsedCsvSample = {
      columnCount: 1,
      columns: ["id"],
      rowCount: 1,
      rows: [["1"]],
    };
    const result = evaluateDeterministicContract(
      contract({
        columns: ["id"],
        id: "available",
        kind: "column_availability",
        question: "Is ID present?",
      }),
      oneRecord,
    );

    expect(result.evidence.limitation).toContain(
      "Only one submitted record",
    );
    expect(result.evidence.limitation).toContain(
      "cannot prove",
    );
  });

  it("is invariant to row order and irrelevant columns", () => {
    const compiled = contract({
      column: "price",
      id: "range",
      kind: "numeric_range",
      maximum: 100,
      minimum: 0,
      question: "Are prices in range?",
    });
    const reordered = {
      ...SAMPLE,
      rows: [...SAMPLE.rows].reverse(),
    };
    const withIrrelevantColumn: ParsedCsvSample = {
      columnCount: SAMPLE.columnCount + 1,
      columns: [...SAMPLE.columns, "irrelevant"],
      rowCount: SAMPLE.rowCount,
      rows: SAMPLE.rows.map((row, index) => [
        ...row,
        `ignored-${index}`,
      ]),
    };

    expect(evaluateDeterministicContract(compiled, reordered)).toEqual(
      evaluateDeterministicContract(compiled, SAMPLE),
    );
    expect(
      evaluateDeterministicContract(compiled, withIrrelevantColumn),
    ).toEqual(evaluateDeterministicContract(compiled, SAMPLE));
  });
});
