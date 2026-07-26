import { describe, expect, it } from "vitest";

import { paidLiveEnabled } from "../testing/paid-live";
import { requestVerifiedPrivateCompletion } from "./client";

const runLive = paidLiveEnabled("ZERO_G_LIVE");

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
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        attempt: 1,
        httpStatus: 200,
        outcome: "succeeded",
      });

      console.info(
        JSON.stringify({
          diagnostics: result.diagnostics,
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
