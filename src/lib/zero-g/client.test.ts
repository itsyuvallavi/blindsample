import { describe, expect, it, vi } from "vitest";

import {
  getZeroGConfig,
  requestVerifiedPrivateCompletion,
  ZeroGClientError,
  type ZeroGClientConfig,
} from "./client";

const TEST_CONFIG: ZeroGClientConfig = {
  apiKey: "sk-test-only",
  baseUrl: "https://router.example/v1",
  model: "test-model",
};

function response(
  body: unknown,
  init: { status?: number } = {},
): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: init.status ?? 200,
  });
}

describe("getZeroGConfig", () => {
  it("accepts only an inference key, model, and HTTPS base URL", () => {
    expect(
      getZeroGConfig({
        ZERO_G_API_KEY: "sk-test-only",
        ZERO_G_BASE_URL: "https://router.example/v1/",
        ZERO_G_MODEL: "test-model",
      }),
    ).toEqual(TEST_CONFIG);
  });

  it("rejects management keys", () => {
    expect(() =>
      getZeroGConfig({
        ZERO_G_API_KEY: "mk-management-key",
        ZERO_G_MODEL: "test-model",
      }),
    ).toThrowError(ZeroGClientError);
  });
});

describe("requestVerifiedPrivateCompletion", () => {
  it("forces private routing and TEE verification", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        choices: [{ message: { content: "OK" } }],
        model: "test-model",
        x_0g_trace: {
          provider: "0xprovider",
          request_id: "request-1",
          tee_verified: true,
        },
      }),
    );

    const result = await requestVerifiedPrivateCompletion(
      [{ content: "Return OK.", role: "user" }],
      { config: TEST_CONFIG, fetchImplementation },
    );

    const request = fetchImplementation.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body)) as {
      verify_tee?: boolean;
    };
    const headers = request?.headers as Record<string, string>;

    expect(headers.Authorization).toBe("Bearer sk-test-only");
    expect(headers["X-0G-Provider-Trust-Mode"]).toBe("private");
    expect(body.verify_tee).toBe(true);
    expect(result.trace).toEqual({
      model: "test-model",
      provider: "0xprovider",
      requestId: "request-1",
      teeVerified: true,
    });
  });

  it("rejects a response that is not TEE verified", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        choices: [{ message: { content: "OK" } }],
        x_0g_trace: {
          provider: "0xprovider",
          request_id: "request-2",
          tee_verified: false,
        },
      }),
    );

    await expect(
      requestVerifiedPrivateCompletion(
        [{ content: "Return OK.", role: "user" }],
        { config: TEST_CONFIG, fetchImplementation },
      ),
    ).rejects.toMatchObject({ code: "unverified_response" });
  });

  it("retries one transient failure without changing trust mode", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({}, { status: 503 }))
      .mockResolvedValueOnce(
        response({
          choices: [{ message: { content: "OK" } }],
          x_0g_trace: {
            provider: "0xprovider",
            request_id: "request-3",
            tee_verified: true,
          },
        }),
      );

    await requestVerifiedPrivateCompletion(
      [{ content: "Return OK.", role: "user" }],
      {
        config: TEST_CONFIG,
        fetchImplementation,
        retryDelayMs: 0,
      },
    );

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    for (const call of fetchImplementation.mock.calls) {
      const headers = call[1]?.headers as Record<string, string>;
      expect(headers["X-0G-Provider-Trust-Mode"]).toBe("private");
    }
  });
});
