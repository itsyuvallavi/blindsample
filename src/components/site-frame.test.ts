import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./site-frame.tsx", import.meta.url),
  "utf8",
);

describe("site frame navigation boundary", () => {
  it("separates public navigation from private task context", () => {
    expect(SOURCE).toContain('variant?: "public" | "task"');
    expect(SOURCE).toContain("publicFrame ?");
    expect(SOURCE).toContain('className="public-links"');
    expect(SOURCE).toContain('className="task-context"');
    expect(SOURCE).toContain("Secure session");
    expect(SOURCE).toContain('<Link href="/docs">Docs</Link>');
    expect(SOURCE).not.toContain("/docs#workflow");
    expect(SOURCE).not.toContain("/docs#privacy");
  });

  it("includes a keyboard skip link", () => {
    expect(SOURCE).toContain('className="skip-link"');
    expect(SOURCE).toContain('id="main-content"');
  });
});
