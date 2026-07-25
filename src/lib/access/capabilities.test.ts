import { describe, expect, it } from "vitest";

import {
  getCapabilityPepper,
  hashCapabilityToken,
  issueEvaluationCapabilities,
  verifyCapabilityToken,
} from "./capabilities";

const TEST_PEPPER = "test-only-pepper-with-at-least-32-characters";

describe("evaluation capabilities", () => {
  it("issues separate 256-bit buyer and seller capabilities", () => {
    const capabilities = issueEvaluationCapabilities(TEST_PEPPER);

    expect(capabilities.buyer.token).toHaveLength(43);
    expect(capabilities.seller.token).toHaveLength(43);
    expect(capabilities.buyer.token).not.toBe(capabilities.seller.token);
    expect(capabilities.buyer.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(capabilities.seller.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies only the matching raw token", () => {
    const capabilities = issueEvaluationCapabilities(TEST_PEPPER);

    expect(
      verifyCapabilityToken(
        capabilities.buyer.token,
        capabilities.buyer.hash,
        TEST_PEPPER,
      ),
    ).toBe(true);
    expect(
      verifyCapabilityToken(
        capabilities.seller.token,
        capabilities.buyer.hash,
        TEST_PEPPER,
      ),
    ).toBe(false);
    expect(
      verifyCapabilityToken(
        capabilities.buyer.token,
        capabilities.buyer.hash,
        `${TEST_PEPPER}-wrong`,
      ),
    ).toBe(false);
  });

  it("stores a one-way HMAC rather than the raw token", () => {
    const capabilities = issueEvaluationCapabilities(TEST_PEPPER);

    expect(
      hashCapabilityToken(capabilities.buyer.token, TEST_PEPPER),
    ).toBe(capabilities.buyer.hash);
    expect(capabilities.buyer.hash).not.toContain(
      capabilities.buyer.token,
    );
  });

  it("rejects a missing or weak environment pepper", () => {
    expect(() => getCapabilityPepper({})).toThrow(
      "at least 32 characters",
    );
    expect(() =>
      getCapabilityPepper({ ACCESS_TOKEN_PEPPER: "too-short" }),
    ).toThrow("at least 32 characters");
  });
});
