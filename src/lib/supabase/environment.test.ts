import { describe, expect, it } from "vitest";

import { getEvaluationEnvironment } from "./environment";

describe("getEvaluationEnvironment", () => {
  it("uses Vercel's production and preview boundaries", () => {
    expect(getEvaluationEnvironment({ VERCEL_ENV: "production" })).toBe(
      "production",
    );
    expect(getEvaluationEnvironment({ VERCEL_ENV: "preview" })).toBe(
      "preview",
    );
  });

  it("falls back to development outside Vercel", () => {
    expect(getEvaluationEnvironment({})).toBe("development");
    expect(getEvaluationEnvironment({ VERCEL_ENV: "unknown" })).toBe(
      "development",
    );
  });
});
