import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./buyer-results.tsx", import.meta.url),
  "utf8",
);

describe("buyer result error presentation", () => {
  it("renders execution errors as not scored with unavailable evidence", () => {
    expect(SOURCE).toContain("not scored");
    expect(SOURCE).toContain("coverageRatio === null");
    expect(SOURCE).toContain("recordsEvaluated === null");
    expect(SOURCE).toContain("A 0G request was attempted");
    expect(SOURCE).toContain("executionErrorExplanation");
  });
});
