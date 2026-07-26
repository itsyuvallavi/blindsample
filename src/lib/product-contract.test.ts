import { describe, expect, it } from "vitest";

import { isValidScore, PRODUCT_LIMITS } from "./product-contract";

describe("BlindSample product contract", () => {
  it("accepts every integer inside the score range", () => {
    expect(isValidScore(PRODUCT_LIMITS.scoreMinimum)).toBe(true);
    expect(isValidScore(50)).toBe(true);
    expect(isValidScore(PRODUCT_LIMITS.scoreMaximum)).toBe(true);
  });

  it("rejects out-of-range and non-integer scores", () => {
    expect(isValidScore(0)).toBe(true);
    expect(isValidScore(-1)).toBe(false);
    expect(isValidScore(101)).toBe(false);
    expect(isValidScore(42.5)).toBe(false);
    expect(isValidScore("88")).toBe(false);
  });
});
