import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./seller-submission.tsx", import.meta.url),
  "utf8",
);

describe("seller submission presentation", () => {
  it("uses the concise seller task flow", () => {
    expect(SOURCE).toContain("Submit your dataset securely");
    expect(SOURCE).toContain("What the buyer wants to know");
    expect(SOURCE).toContain("Run private evaluation");
    expect(SOURCE).toContain(
      "No 0G tokens are spent before this click.",
    );
    expect(SOURCE).toContain("TLS-encrypted transport");
  });

  it("runs the free structured-sample preflight before submission", () => {
    expect(SOURCE).toContain("parseSample");
    expect(SOURCE).toContain(".jsonl");
    expect(SOURCE).toContain(".parquet");
    expect(SOURCE).toContain("formatLabel(preflight.format)");
    expect(SOURCE).toContain("Passed locally");
    expect(SOURCE).toContain("No 0G request was made.");
  });

  it("does not use the previous terminal submission furniture", () => {
    expect(SOURCE).not.toContain("TerminalBar");
    expect(SOURCE).not.toContain("CommandLine");
    expect(SOURCE).not.toContain("SecurityRail");
  });
});
