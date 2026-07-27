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
  it("keeps a focused encrypted-evaluation hero on the homepage", () => {
    expect(HOME_SOURCE).toContain('href="/new"');
    expect(HOME_SOURCE).toContain(
      '<SiteFrame currentPage="home" landing',
    );
    expect(HOME_SOURCE).toContain("Encrypted answers");
    expect(HOME_SOURCE).toContain("data you cannot share");
    expect(HOME_SOURCE).toContain("Example evaluation");
    expect(HOME_SOURCE).toContain("private news feed");
    expect(HOME_SOURCE).toContain("news_feed.csv");
    expect(HOME_SOURCE).toContain("Seller keeps control");
    expect(HOME_SOURCE).toContain("Raw rows stay private");
    expect(HOME_SOURCE).toContain("TEE verified");
    expect(HOME_SOURCE).not.toContain("how-it-works");
    expect(HOME_SOURCE).not.toContain("proof-section");
    expect(HOME_SOURCE).not.toContain("EvaluationBuilder");
    expect(NEW_SOURCE).toContain("<EvaluationBuilder />");
  });

  it("documents the workflow without weakening product guarantees", () => {
    expect(DOCS_SOURCE).toContain("No overall score.");
    expect(DOCS_SOURCE).toContain("one private 0G request");
    expect(DOCS_SOURCE).toContain("TEE verification");
    expect(DOCS_SOURCE).toContain("TLS encrypts the sample in transit");
    expect(DOCS_SOURCE).toContain("publishes no scores");
    expect(DOCS_SOURCE).toMatch(
      /Questions do\s+not\s+need to reference columns or scoring types/,
    );
  });
});
