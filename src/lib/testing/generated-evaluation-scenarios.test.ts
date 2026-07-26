import { describe, expect, it } from "vitest";

import { parseCsvSample } from "../csv/parse-sample";
import { GENERATED_ADVERSARIAL_SCENARIOS } from "./generated-evaluation-scenarios";

describe("generated adversarial evaluation scenarios", () => {
  it("generates three reproducible datasets with fixed oracle scores", () => {
    expect(
      GENERATED_ADVERSARIAL_SCENARIOS.map((scenario) => ({
        id: scenario.id,
        scores: scenario.questions.map(
          (question) => question.expected.exact,
        ),
      })),
    ).toEqual([
      {
        id: "generated-ledger-integrity",
        scores: [76, 86, 73],
      },
      {
        id: "generated-minute-series",
        scores: [73, 89, 93],
      },
      {
        id: "generated-support-semantics",
        scores: [60, 40, 20],
      },
    ]);
  });

  it("produces parseable, nontrivial CSV samples", () => {
    const samples = GENERATED_ADVERSARIAL_SCENARIOS.map(
      (scenario) =>
        parseCsvSample(new TextEncoder().encode(scenario.csv)),
    );

    expect(samples.map((sample) => sample.rowCount)).toEqual([
      37, 28, 20,
    ]);
    expect(samples.map((sample) => sample.columns)).toEqual([
      ["transaction_id", "timestamp", "amount"],
      ["timestamp", "reading"],
      ["message"],
    ]);
    expect(
      GENERATED_ADVERSARIAL_SCENARIOS.every(
        (scenario) => scenario.questions.length === 3,
      ),
    ).toBe(true);
  });

  it("precomputes row-number-only semantic oracles", () => {
    const semantic = GENERATED_ADVERSARIAL_SCENARIOS.find(
      (scenario) =>
        scenario.id === "generated-support-semantics",
    );

    expect(
      semantic?.questions.map(
        (question) => question.expectedPassingRows?.length,
      ),
    ).toEqual([12, 8, 4]);
    expect(
      semantic?.questions.every((question) =>
        question.expectedPassingRows?.every(
          (rowNumber) => rowNumber >= 1 && rowNumber <= 20,
        ),
      ),
    ).toBe(true);
  });
});
