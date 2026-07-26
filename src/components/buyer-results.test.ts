import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./buyer-results.tsx", import.meta.url),
  "utf8",
);

describe("buyer result presentation", () => {
  it("uses the required atomic 0G states", () => {
    expect(SOURCE).toContain("0G evaluation in progress");
    expect(SOURCE).toContain(
      "All questions were evaluated by 0G.",
    );
    expect(SOURCE).toContain(
      "Evaluation failed — no scores were produced.",
    );
    expect(SOURCE).toContain("Evaluated by 0G");
  });

  it("never presents partial or local scores", () => {
    expect(SOURCE).toContain("verifiedComplete");
    expect(SOURCE).toContain(
      "No partial or previous scores were published.",
    );
    expect(SOURCE).not.toContain("AUDIT COMPLETE");
    expect(SOURCE).not.toContain("PARTIAL RESULTS");
    expect(SOURCE).not.toContain("deterministic");
  });

  it("does not reveal the seller's sample size or model evidence", () => {
    expect(SOURCE).not.toContain("sampleRowCount");
    expect(SOURCE).not.toContain("sampleColumnCount");
    expect(SOURCE).not.toContain("numerator");
    expect(SOURCE).not.toContain("denominator");
    expect(SOURCE).not.toContain("rowNumbers");
    expect(SOURCE).not.toContain("aggregateCounts");
  });

  it("uses a distinct all-unable state", () => {
    expect(SOURCE).toContain("No scores were produced");
    expect(SOURCE).toContain(
      "This does not mean the dataset failed your requirements.",
    );
  });
});
