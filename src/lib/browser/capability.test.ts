import { describe, expect, it } from "vitest";

import { readCapabilityToken } from "./capability";

describe("browser capability fragments", () => {
  it("extracts one valid token without sending it in the URL query", () => {
    const token = "A_-".repeat(14) + "A";

    expect(readCapabilityToken(`#token=${token}`)).toBe(token);
  });

  it.each([
    "",
    "#token=short",
    `#token=${"a".repeat(43)}&role=buyer`,
    `#token=${"a".repeat(43)}&token=${"b".repeat(43)}`,
  ])("rejects malformed or ambiguous fragments: %s", (hash) => {
    expect(readCapabilityToken(hash)).toBeNull();
  });
});
