import type { EvaluationResult } from "../scoring/types";

export function completedResultPresentation(
  results: EvaluationResult[],
) {
  const scoredCount = results.filter(
    (result) => result.status === "scored",
  ).length;
  const errorCount = results.filter(
    (result) => result.status === "error",
  ).length;
  const allUnable =
    results.length > 0 &&
    scoredCount === 0 &&
    errorCount === 0;
  const hasErrors = errorCount > 0;

  if (hasErrors) {
    return {
      allUnable: false,
      badge:
        scoredCount > 0 ? "PARTIAL RESULTS" : "EVALUATION ERROR",
      errorCount,
      hasErrors: true,
      headline:
        scoredCount > 0
          ? `${scoredCount} question-level score${scoredCount === 1 ? "" : "s"} published; ${errorCount} question${errorCount === 1 ? "" : "s"} failed to run.`
          : "No scores were produced because the evaluation failed to run.",
      scoredCount,
      status: scoredCount > 0 ? "PARTIAL" : "ERROR",
    };
  }

  return {
    allUnable,
    errorCount,
    hasErrors: false,
    badge: allUnable ? "NO SCORES PRODUCED" : "AUDIT COMPLETE",
    headline: allUnable
      ? "No numeric question scores were produced."
      : `${scoredCount} question-level score${scoredCount === 1 ? "" : "s"} published.`,
    scoredCount,
    status: allUnable ? "NO SCORES" : "COMPLETE",
  };
}
