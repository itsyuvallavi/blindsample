import { describe, expect, it, vi } from "vitest";

import {
  getZeroGConfig,
  requestVerifiedPrivateCompletion,
  ZERO_G_REQUEST_TIMEOUT_MS,
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

  it("rejects a non-mainnet Router URL in production", () => {
    expect(() =>
      getZeroGConfig({
        VERCEL_ENV: "production",
        ZERO_G_API_KEY: "sk-test-only",
        ZERO_G_BASE_URL:
          "https://router-api-testnet.integratenetwork.work/v1",
        ZERO_G_MODEL: "test-model",
      }),
    ).toThrowError("Production must use the 0G mainnet Router base URL.");
  });
});

describe("requestVerifiedPrivateCompletion", () => {
  it("allows one verified request to run for up to two minutes", async () => {
    const timeoutSignal = new AbortController().signal;
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutSignal);
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        choices: [{ message: { content: "OK" } }],
        x_0g_trace: {
          provider: "0xprovider",
          request_id: "request-timeout",
          tee_verified: true,
        },
      }),
    );

    try {
      await requestVerifiedPrivateCompletion(
        [{ content: "Return OK.", role: "user" }],
        { config: TEST_CONFIG, fetchImplementation },
      );

      expect(ZERO_G_REQUEST_TIMEOUT_MS).toBe(120_000);
      expect(timeoutSpy).toHaveBeenCalledOnce();
      expect(timeoutSpy).toHaveBeenCalledWith(120_000);
      expect(fetchImplementation).toHaveBeenCalledOnce();
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("forces private routing and TEE verification", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: "OK",
              reasoning_content: "must never be retained",
            },
          },
        ],
        model: "test-model",
        usage: {
          completion_tokens: 4,
          completion_tokens_details: { reasoning_tokens: 2 },
          prompt_tokens: 7,
          total_tokens: 11,
        },
        x_0g_trace: {
          billing: {
            input_cost: "700",
            output_cost: "400",
            total_cost: "1100",
          },
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
    expect(result.diagnostics).toEqual([
      {
        attempt: 1,
        billing: {
          inputCostNeuron: "700",
          outputCostNeuron: "400",
          totalCostNeuron: "1100",
        },
        durationMs: expect.any(Number),
        finishReason: "stop",
        httpStatus: 200,
        outcome: "succeeded",
        reasoningContentPresent: true,
        responseLength: 2,
        usage: {
          completionTokens: 4,
          promptTokens: 7,
          reasoningTokens: 2,
          totalTokens: 11,
        },
      },
    ]);
    expect(JSON.stringify(result.diagnostics)).not.toContain(
      "must never be retained",
    );
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

    const rejected = requestVerifiedPrivateCompletion(
      [{ content: "Return OK.", role: "user" }],
      { config: TEST_CONFIG, fetchImplementation },
    );

    await expect(rejected).rejects.toMatchObject({
      code: "unverified_response",
      diagnostics: [
        expect.objectContaining({
          attempt: 1,
          httpStatus: 200,
          outcome: "unverified_response",
          responseLength: 2,
        }),
      ],
    });
  });

  it("never retries a failed paid request automatically", async () => {
    for (const status of [429, 503]) {
      const fetchImplementation = vi
        .fn<typeof fetch>()
        .mockResolvedValue(response({}, { status }));

      await expect(
        requestVerifiedPrivateCompletion(
          [{ content: "Return OK.", role: "user" }],
          { config: TEST_CONFIG, fetchImplementation },
        ),
      ).rejects.toMatchObject({
        code: "request_failed",
        diagnostics: [
          expect.objectContaining({
            attempt: 1,
            httpStatus: status,
            outcome: "http_error",
          }),
        ],
        status,
      });

      expect(fetchImplementation).toHaveBeenCalledTimes(1);
    }
  });

  it("requests JSON mode and disables GLM thinking only when asked", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        choices: [{ message: { content: "{}" } }],
        x_0g_trace: {
          provider: "0xprovider",
          request_id: "request-json",
          tee_verified: true,
        },
      }),
    );

    await requestVerifiedPrivateCompletion(
      [{ content: "Return JSON.", role: "user" }],
      {
        config: { ...TEST_CONFIG, model: "glm-5.2" },
        disableThinking: true,
        fetchImplementation,
        responseFormat: "json_object",
      },
    );

    const body = JSON.parse(
      String(fetchImplementation.mock.calls[0]?.[1]?.body),
    ) as {
      chat_template_kwargs?: { enable_thinking?: boolean };
      response_format?: { type?: string };
    };

    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.chat_template_kwargs).toEqual({
      enable_thinking: false,
    });
  });

  it("leaves GLM reasoning enabled by default", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        choices: [{ message: { content: "{}" } }],
        x_0g_trace: {
          provider: "0xprovider",
          request_id: "request-reasoning",
          tee_verified: true,
        },
      }),
    );

    await requestVerifiedPrivateCompletion(
      [{ content: "Evaluate carefully.", role: "user" }],
      {
        config: { ...TEST_CONFIG, model: "glm-5.2" },
        fetchImplementation,
      },
    );

    const body = JSON.parse(
      String(fetchImplementation.mock.calls[0]?.[1]?.body),
    ) as {
      chat_template_kwargs?: { enable_thinking?: boolean };
    };

    expect(body.chat_template_kwargs).toBeUndefined();
  });

  it("forces one named function and parses only its JSON arguments", async () => {
    const argumentsJson =
      '{"evaluation_id":"evaluation-1","results":[]}';
    const functionTool = {
      description: "Submit one evaluation.",
      name: "submit_cipherquery_evaluation",
      parameters: {
        additionalProperties: false,
        properties: {
          evaluation_id: { type: "string" },
          results: { type: "array" },
        },
        required: ["evaluation_id", "results"],
        type: "object",
      },
    };
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  function: {
                    arguments: argumentsJson,
                    name: functionTool.name,
                  },
                  type: "function",
                },
              ],
            },
          },
        ],
        x_0g_trace: {
          provider: "0xprovider",
          request_id: "request-tool",
          tee_verified: true,
        },
      }),
    );

    const result = await requestVerifiedPrivateCompletion(
      [{ content: "Evaluate.", role: "user" }],
      {
        config: { ...TEST_CONFIG, model: "glm-5.2" },
        disableThinking: true,
        fetchImplementation,
        functionTool,
      },
    );
    const body = JSON.parse(
      String(fetchImplementation.mock.calls[0]?.[1]?.body),
    ) as {
      tool_choice?: unknown;
      tools?: unknown;
    };

    expect(result.content).toBe(argumentsJson);
    expect(result.diagnostics[0]?.responseLength).toBe(
      argumentsJson.length,
    );
    expect(body.tool_choice).toEqual({
      function: { name: functionTool.name },
      type: "function",
    });
    expect(body.tools).toEqual([
      { function: functionTool, type: "function" },
    ]);
  });

  it("rejects assistant text when a function result is required", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        choices: [{ message: { content: "private model text" } }],
        x_0g_trace: {
          provider: "0xprovider",
          request_id: "request-missing-tool",
          tee_verified: true,
        },
      }),
    );

    const rejected = requestVerifiedPrivateCompletion(
      [{ content: "Evaluate.", role: "user" }],
      {
        config: TEST_CONFIG,
        fetchImplementation,
        functionTool: {
          description: "Submit one evaluation.",
          name: "submit_cipherquery_evaluation",
          parameters: { type: "object" },
        },
      },
    );

    await expect(rejected).rejects.toMatchObject({
      code: "invalid_response",
      diagnostics: [
        expect.objectContaining({
          outcome: "invalid_response",
          responseLength: null,
        }),
      ],
    });

    try {
      await rejected;
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(
        "private model text",
      );
    }
  });

  it("captures safe failure metadata without retaining response bodies", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("private provider error", { status: 400 }),
    );

    const rejected = requestVerifiedPrivateCompletion(
      [{ content: "private submitted record", role: "user" }],
      { config: TEST_CONFIG, fetchImplementation },
    );

    await expect(rejected).rejects.toMatchObject({
      code: "request_failed",
      diagnostics: [
        expect.objectContaining({
          attempt: 1,
          httpStatus: 400,
          outcome: "http_error",
        }),
      ],
      status: 400,
    });

    try {
      await rejected;
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain("private provider error");
      expect(JSON.stringify(error)).not.toContain(
        "private submitted record",
      );
    }
  });
});
