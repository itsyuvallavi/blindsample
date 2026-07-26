import { describe, expect, it } from "vitest";

import { compileEvaluationContracts } from "./compile";
import {
  createDefaultSemanticCriterion,
  hasDefaultSemanticSetupMismatch,
  semanticCriterionFingerprint,
} from "./default-semantic";

describe("default semantic criterion", () => {
  it("compiles the calibrated customer-support contract", () => {
    const criterion = createDefaultSemanticCriterion("support");
    const [contract] = compileEvaluationContracts([criterion]);

    expect(contract).toMatchObject({
      method: "semantic",
      questionId: "support",
      requiredColumns: ["message"],
    });
    expect(criterion.controls.intermediate).toBe(
      "A customer asks a general subscription question that may be answered by documentation or an agent.",
    );
    expect(criterion.controls.intermediate).not.toBe(
      "A general product question.",
    );
  });

  it("detects a changed question paired with untouched template scoring", () => {
    const criterion = createDefaultSemanticCriterion("support");
    const originalFingerprint =
      semanticCriterionFingerprint(criterion);
    const changedQuestion = {
      ...criterion,
      question:
        "Does this dataset provide uninterrupted BTC-USD prices?",
    };

    expect(hasDefaultSemanticSetupMismatch(changedQuestion)).toBe(true);
    expect(semanticCriterionFingerprint(changedQuestion)).not.toBe(
      originalFingerprint,
    );
    expect(
      hasDefaultSemanticSetupMismatch({
        ...changedQuestion,
        columns: ["timestamp", "btc_usd"],
        target:
          "One numeric BTC-USD price for every required minute.",
      }),
    ).toBe(false);
  });
});
