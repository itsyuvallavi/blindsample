import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./evaluation-builder.tsx", import.meta.url),
  "utf8",
);

describe("buyer evaluation builder contract", () => {
  it("asks only for an evaluation name and plain-text questions", () => {
    expect(SOURCE).toContain(
      "What do you want to know about this dataset?",
    );
    expect(SOURCE).toContain("Evaluation name");
    expect(SOURCE).not.toContain("<select");
    expect(SOURCE).not.toContain("What should we check?");
    expect(SOURCE).not.toContain(
      "How should this question be scored?",
    );
    expect(SOURCE).not.toContain("CriterionSettings");
    expect(SOURCE).not.toContain("approvedContractSetHash");
  });

  it("keeps the buyer setup focused on questions and private links", () => {
    expect(SOURCE).toContain("Create private links");
    expect(SOURCE).toContain("No CSV is uploaded");
    expect(SOURCE).not.toContain("Move up");
    expect(SOURCE).not.toContain("Move down");
    expect(SOURCE).not.toContain("TerminalBar");
    expect(SOURCE).not.toContain("CommandLine");
    expect(SOURCE).not.toContain("ExperiencePreviews");
  });
});
