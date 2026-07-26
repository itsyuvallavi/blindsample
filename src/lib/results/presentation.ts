import type { EvaluationResult } from "../scoring/types";

export function completedResultPresentation(
  results: EvaluationResult[],
) {
  const scoredCount = results.filter(
    (result) => result.status === "scored",
  ).length;
  const allUnable =
    results.length > 0 && scoredCount === 0;

  return {
    allUnable,
    badge: allUnable ? "NO SCORES PRODUCED" : "AUDIT COMPLETE",
    headline: allUnable
      ? "No numeric question scores were produced."
      : `${scoredCount} question-level score${scoredCount === 1 ? "" : "s"} published.`,
    status: allUnable ? "NO SCORES" : "COMPLETE",
  };
}
