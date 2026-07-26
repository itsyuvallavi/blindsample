import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const HOME_SOURCE = readFileSync(
  new URL("./page.tsx", import.meta.url),
  "utf8",
);
const NEW_SOURCE = readFileSync(
  new URL("./new/page.tsx", import.meta.url),
  "utf8",
);
const DOCS_SOURCE = readFileSync(
  new URL("./docs/page.tsx", import.meta.url),
  "utf8",
);

describe("public information architecture", () => {
  it("keeps marketing and evaluation creation on separate routes", () => {
    expect(HOME_SOURCE).toContain('href="/new"');
    expect(HOME_SOURCE).toContain("Illustrative result");
    expect(HOME_SOURCE).toContain("Encrypted in transit");
    expect(HOME_SOURCE).toContain("TEE-protected compute");
    expect(HOME_SOURCE).toContain("Raw rows never shared");
    expect(HOME_SOURCE).not.toContain("EvaluationBuilder");
    expect(NEW_SOURCE).toContain("<EvaluationBuilder />");
  });

  it("documents the workflow without weakening product guarantees", () => {
    expect(DOCS_SOURCE).toContain("No overall score.");
    expect(DOCS_SOURCE).toContain("one private request");
    expect(DOCS_SOURCE).toContain("TEE verification");
    expect(DOCS_SOURCE).toContain("TLS encrypts the CSV in transit");
    expect(DOCS_SOURCE).toContain("publishes no scores");
    expect(DOCS_SOURCE).toMatch(
      /Questions do\s+not need to reference columns or scoring types/,
    );
  });
});
