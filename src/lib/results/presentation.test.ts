import { describe, expect, it } from "vitest";

import type { EvaluationResult } from "../scoring/types";
import { completedResultPresentation } from "./presentation";

const UNABLE = {
  status: "unable_to_score",
} as EvaluationResult;
const SCORED = {
  status: "scored",
} as EvaluationResult;
const ERROR = {
  status: "error",
} as EvaluationResult;

describe("completed result presentation", () => {
  it("never calls an all-unable evaluation audit complete", () => {
    expect(completedResultPresentation([UNABLE, UNABLE])).toEqual({
      allUnable: true,
      badge: "NO SCORES PRODUCED",
      errorCount: 0,
      hasErrors: false,
      headline: "No numeric question scores were produced.",
      scoredCount: 0,
      status: "NO SCORES",
    });
  });

  it("uses audit complete when at least one score exists", () => {
    expect(
      completedResultPresentation([UNABLE, SCORED]),
    ).toMatchObject({
      allUnable: false,
      badge: "AUDIT COMPLETE",
      hasErrors: false,
      status: "COMPLETE",
    });
  });

  it("labels execution errors separately from unable and zero scores", () => {
    expect(completedResultPresentation([ERROR])).toMatchObject({
      allUnable: false,
      badge: "EVALUATION ERROR",
      errorCount: 1,
      hasErrors: true,
      scoredCount: 0,
      status: "ERROR",
    });

    expect(
      completedResultPresentation([SCORED, ERROR]),
    ).toMatchObject({
      badge: "PARTIAL RESULTS",
      errorCount: 1,
      hasErrors: true,
      scoredCount: 1,
      status: "PARTIAL",
    });
  });
});
