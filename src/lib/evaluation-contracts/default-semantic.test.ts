import { describe, expect, it } from "vitest";

import { compileEvaluationContracts } from "./compile";
import { createDefaultSemanticCriterion } from "./default-semantic";

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
});
