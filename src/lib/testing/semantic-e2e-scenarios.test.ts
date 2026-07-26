import { describe, expect, it } from "vitest";

import {
  SEMANTIC_E2E_CRITERIA,
  SEMANTIC_E2E_MAXIMUM_INFERENCE_REQUESTS,
  SEMANTIC_E2E_SCENARIOS,
} from "./semantic-e2e-scenarios";

describe("semantic E2E scenario matrix", () => {
  it("defines ten bounded scenarios and a twenty-request ceiling", () => {
    expect(SEMANTIC_E2E_CRITERIA).toHaveLength(2);
    expect(SEMANTIC_E2E_SCENARIOS).toHaveLength(10);
    expect(SEMANTIC_E2E_MAXIMUM_INFERENCE_REQUESTS).toBe(20);
    expect(new Set(SEMANTIC_E2E_SCENARIOS.map(({ id }) => id)).size).toBe(
      10,
    );

    for (const scenario of SEMANTIC_E2E_SCENARIOS) {
      expect(scenario.rows).toHaveLength(5);
      expect(scenario.rows.every((row) => row.trim().length > 0)).toBe(
        true,
      );
      expect(scenario.expectedSemanticScore).toBeGreaterThanOrEqual(1);
      expect(scenario.expectedSemanticScore).toBeLessThanOrEqual(100);
    }
  });

  it("contains the intended anchor, mixture, injection, and order cases", () => {
    expect(
      SEMANTIC_E2E_SCENARIOS.map(
        ({ expectedSemanticScore, id }) => [
          id,
          expectedSemanticScore,
        ],
      ),
    ).toEqual([
      ["positive_anchor", 100],
      ["strong_anchor", 75],
      ["intermediate_anchor", 50],
      ["weak_anchor", 25],
      ["negative_anchor", 1],
      ["balanced_mix", 50],
      ["mostly_positive", 80],
      ["mostly_negative", 21],
      ["prompt_injection", 100],
      ["balanced_reversed", 50],
    ]);
  });
});
