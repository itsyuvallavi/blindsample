import { describe, expect, it } from "vitest";

import {
  SEMANTIC_E2E_EXPECTED_QUESTION_RESULTS,
  SEMANTIC_E2E_MAXIMUM_INFERENCE_REQUESTS,
  SEMANTIC_E2E_SCENARIOS,
} from "./semantic-e2e-scenarios";

describe("semantic E2E scenario matrix", () => {
  it("defines five scenarios with multiple independent questions", () => {
    expect(SEMANTIC_E2E_SCENARIOS).toHaveLength(5);
    expect(SEMANTIC_E2E_EXPECTED_QUESTION_RESULTS).toBe(13);
    expect(SEMANTIC_E2E_MAXIMUM_INFERENCE_REQUESTS).toBe(16);
    expect(new Set(SEMANTIC_E2E_SCENARIOS.map(({ id }) => id)).size).toBe(
      5,
    );

    let multiSemanticScenarios = 0;

    for (const scenario of SEMANTIC_E2E_SCENARIOS) {
      const semanticCount = scenario.questions.filter(
        ({ id }) => id !== "completeness",
      ).length;
      const questionIds = scenario.questions.map(({ id }) => id);

      expect(scenario.questions.length).toBeGreaterThanOrEqual(2);
      expect(Object.keys(scenario.expectedScores).sort()).toEqual(
        [...questionIds].sort(),
      );
      expect(scenario.rows).toHaveLength(5);
      expect(scenario.rows.every((row) => row.trim().length > 0)).toBe(
        true,
      );

      for (const score of Object.values(scenario.expectedScores)) {
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(100);
      }

      if (semanticCount > 1) {
        multiSemanticScenarios += 1;
      }
    }

    expect(multiSemanticScenarios).toBe(3);
  });

  it("defines independently calculated scores for every question", () => {
    expect(
      SEMANTIC_E2E_SCENARIOS.map(({ expectedScores, id }) => [
        id,
        expectedScores,
      ]),
    ).toEqual([
      [
        "security_actions",
        {
          action_required: 100,
          completeness: 100,
          security_risk: 100,
        },
      ],
      [
        "documentation_questions",
        {
          action_required: 25,
          completeness: 100,
          documentation_answerable: 100,
        },
      ],
      [
        "unrelated_records",
        {
          action_required: 1,
          completeness: 100,
        },
      ],
      [
        "balanced_action",
        {
          action_required: 50,
          completeness: 100,
        },
      ],
      [
        "prompt_injection",
        {
          action_required: 100,
          completeness: 100,
          manipulation_attempt: 100,
        },
      ],
    ]);
  });

  it("defines buyer input as questions without technical plans", () => {
    const serialized = JSON.stringify(SEMANTIC_E2E_SCENARIOS);

    expect(serialized).not.toContain('"criteria"');
    expect(serialized).not.toContain('"columns"');
    expect(serialized).not.toContain('"kind"');
    expect(serialized).not.toContain('"controls"');
  });
});
