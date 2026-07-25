import { describe, expect, it } from "vitest";

import { requestVerifiedPrivateCompletion } from "./client";

const runLive = process.env.ZERO_G_LIVE === "1";

describe.skipIf(!runLive)("0G Private Computer live verification", () => {
  it(
    "returns a Router-verified TEE trace",
    async () => {
      const result = await requestVerifiedPrivateCompletion(
        [{ content: "Return only the word OK.", role: "user" }],
        { maxTokens: 16 },
      );

      expect(result.trace.teeVerified).toBe(true);
      expect(result.trace.provider).toMatch(/^0x[0-9a-f]+$/i);
      expect(result.trace.requestId.length).toBeGreaterThan(0);

      console.info(
        JSON.stringify({
          model: result.trace.model,
          provider: result.trace.provider,
          requestId: result.trace.requestId,
          teeVerified: result.trace.teeVerified,
        }),
      );
    },
    45_000,
  );
});
