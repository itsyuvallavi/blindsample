import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./buyer-results.tsx", import.meta.url),
  "utf8",
);

describe("buyer result presentation", () => {
  it("uses the required atomic 0G states", () => {
    expect(SOURCE).toContain("0G evaluation in progress.");
    expect(SOURCE).toContain(
      "Evaluation complete — all questions evaluated by 0G.",
    );
    expect(SOURCE).toContain(
      "Evaluation failed — no scores were produced.",
    );
    expect(SOURCE).toContain("Evaluated by 0G");
  });

  it("never presents partial or local scores", () => {
    expect(SOURCE).toContain("isAtomicVerifiedResultSet");
    expect(SOURCE).toContain("No local,");
    expect(SOURCE).toContain(
      "partial, or previous score was published.",
    );
    expect(SOURCE).not.toContain("AUDIT COMPLETE");
    expect(SOURCE).not.toContain("PARTIAL RESULTS");
    expect(SOURCE).not.toContain("deterministic");
  });
});
