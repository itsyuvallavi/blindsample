import { describe, expect, it } from "vitest";

import { paidLiveEnabled } from "./paid-live";

describe("paidLiveEnabled", () => {
  it("requires both suite selection and explicit paid approval", () => {
    expect(
      paidLiveEnabled("SCORING_LIVE", {
        SCORING_LIVE: "1",
      }),
    ).toBe(false);
    expect(
      paidLiveEnabled("SCORING_LIVE", {
        ALLOW_PAID_0G: "1",
      }),
    ).toBe(false);
    expect(
      paidLiveEnabled("SCORING_LIVE", {
        ALLOW_PAID_0G: "1",
        SCORING_LIVE: "1",
      }),
    ).toBe(true);
    expect(
      paidLiveEnabled("SEMANTIC_DIAGNOSTIC_LIVE", {
        ALLOW_PAID_0G: "1",
        SEMANTIC_DIAGNOSTIC_LIVE: "1",
      }),
    ).toBe(true);
    expect(
      paidLiveEnabled("SCENARIO_MATRIX_LIVE", {
        ALLOW_PAID_0G: "1",
        SCENARIO_MATRIX_LIVE: "1",
      }),
    ).toBe(true);
  });
});
