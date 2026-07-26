import { describe, expect, it } from "vitest";

import { compileEvaluationContracts } from "./compile";
import { hashEvaluationContracts } from "./hash";

const DRAFT = {
  columns: ["description"],
  controls: {
    intermediate: "A general product question.",
    negative: "A weather report.",
    positive: "A customer asks an agent to fix a billing error.",
  },
  id: "relevance",
  kind: "semantic_relevance",
  question: "Is this relevant?",
  target: "Customer support requests requiring an agent response.",
} as const;

describe("hashEvaluationContracts", () => {
  it("binds approval to the exact reviewed contract set", () => {
    const contracts = compileEvaluationContracts([DRAFT]);
    const sameContracts = compileEvaluationContracts([DRAFT]);
    const changedContracts = compileEvaluationContracts([
      { ...DRAFT, target: `${DRAFT.target} Urgent requests only.` },
    ]);

    expect(hashEvaluationContracts(contracts)).toBe(
      hashEvaluationContracts(sameContracts),
    );
    expect(hashEvaluationContracts(changedContracts)).not.toBe(
      hashEvaluationContracts(contracts),
    );
    expect(hashEvaluationContracts(contracts)).toMatch(/^[0-9a-f]{64}$/);
  });
});
