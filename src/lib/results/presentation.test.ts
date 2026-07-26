import { describe, expect, it } from "vitest";

import type { EvaluationResult } from "../scoring/types";
import { completedResultPresentation } from "./presentation";

const UNABLE = {
  status: "unable_to_score",
} as EvaluationResult;
const SCORED = {
  status: "scored",
} as EvaluationResult;

describe("completed result presentation", () => {
  it("never calls an all-unable evaluation audit complete", () => {
    expect(completedResultPresentation([UNABLE, UNABLE])).toEqual({
      allUnable: true,
      badge: "NO SCORES PRODUCED",
      headline: "No numeric question scores were produced.",
      status: "NO SCORES",
    });
  });

  it("uses audit complete when at least one score exists", () => {
    expect(
      completedResultPresentation([UNABLE, SCORED]),
    ).toMatchObject({
      allUnable: false,
      badge: "AUDIT COMPLETE",
      status: "COMPLETE",
    });
  });
});
