import { parseCsvSample } from "../csv/parse-sample";
import type { CriterionDraft } from "../evaluation-contracts/types";

export const LIVE_SEMANTIC_CRITERION = {
  columns: ["message"],
  controls: {
    intermediate:
      "A customer asks a general subscription question that may be answered by documentation or an agent.",
    negative:
      "A standalone weather forecast with no customer-service request.",
    positive:
      "A customer explicitly asks a support agent to unlock their account.",
  },
  id: "support_relevance",
  kind: "semantic_relevance",
  question:
    "Are these useful examples of customer requests needing support?",
  target: "Customer requests that require a support agent to take action.",
} satisfies CriterionDraft;

export function createLiveSemanticSample() {
  return parseCsvSample(
    new TextEncoder().encode(
      [
        "message",
        "My invoice has the wrong amount.",
        "Please help me reset my account password.",
        "I need a refund for a duplicate charge.",
        "The dashboard will not load.",
        "Please update the email on my account.",
      ].join("\n"),
    ),
  );
}
