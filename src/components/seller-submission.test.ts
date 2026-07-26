import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./seller-submission.tsx", import.meta.url),
  "utf8",
);

describe("seller submission presentation", () => {
  it("uses the concise seller task flow", () => {
    expect(SOURCE).toContain("Submit a private CSV sample");
    expect(SOURCE).toContain("What the buyer wants to know");
    expect(SOURCE).toContain("Run private evaluation");
    expect(SOURCE).toContain(
      "No 0G tokens are spent before this click.",
    );
  });

  it("runs the free CSV preflight before submission", () => {
    expect(SOURCE).toContain("parseCsvSample");
    expect(SOURCE).toContain("Passed locally");
    expect(SOURCE).toContain("No 0G request was made.");
  });

  it("does not use the previous terminal submission furniture", () => {
    expect(SOURCE).not.toContain("TerminalBar");
    expect(SOURCE).not.toContain("CommandLine");
    expect(SOURCE).not.toContain("SecurityRail");
  });
});
