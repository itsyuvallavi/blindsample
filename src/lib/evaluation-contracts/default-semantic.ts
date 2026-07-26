import type { CriterionDraft } from "./types";

export type SemanticCriterionDraft = Extract<
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

export function semanticCriterionFingerprint(
  criterion: SemanticCriterionDraft,
) {
  return JSON.stringify({
    columns: criterion.columns,
    controls: criterion.controls,
    question: criterion.question,
    target: criterion.target,
  });
}

export function hasDefaultSemanticSetupMismatch(
  criterion: SemanticCriterionDraft,
) {
  const defaults = createDefaultSemanticCriterion(criterion.id);

  return (
    normalize(criterion.question) !== normalize(defaults.question) &&
    JSON.stringify({
      columns: criterion.columns,
      controls: criterion.controls,
      target: criterion.target,
    }) ===
      JSON.stringify({
        columns: defaults.columns,
        controls: defaults.controls,
        target: defaults.target,
      })
  );
}

function normalize(value: string) {
  return value.trim().replaceAll(/\s+/g, " ").toLowerCase();
}
