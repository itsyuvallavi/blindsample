import type { CriterionDraft } from "./types";

type SemanticCriterionDraft = Extract<
  CriterionDraft,
  { kind: "semantic_relevance" }
>;

export function createDefaultSemanticCriterion(
  id: string,
): SemanticCriterionDraft {
  return {
    columns: ["message"],
    controls: {
      intermediate:
        "A customer asks a general subscription question that may be answered by documentation or an agent.",
      negative: "A weather report unrelated to customer support.",
      positive: "A customer asks an agent to fix a billing error.",
    },
    id,
    kind: "semantic_relevance",
    question: "Is this useful for a customer support classifier?",
    target: "Customer support requests requiring an agent response.",
  };
}
