import { afterEach, describe, expect, it, vi } from "vitest";

import { emitInferenceRunEvents } from "./inference";

describe("inference observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs only sanitized request metadata", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    emitInferenceRunEvents("evaluation-1", "complete", {
      outputValidation: {
        failureCode: null,
        status: "passed",
      },
      requestCount: { made: 1, maximum: 1 },
      requests: [
        {
          attempt: 1,
          billing: {
            inputCostNeuron: null,
            outputCostNeuron: null,
            totalCostNeuron: null,
          },
          durationMs: 12,
          finishReason: "stop",
          httpStatus: 200,
          model: "model",
          outcome: "succeeded",
          provider: "provider",
          reasoningContentPresent: false,
          requestId: "request",
          responseLength: 400,
          teeVerified: true,
          usage: {
            completionTokens: 20,
            promptTokens: 30,
            reasoningTokens: 0,
            totalTokens: 50,
          },
        },
      ],
    });

    const logged = String(info.mock.calls[0]?.[0]);
    expect(logged).toContain("private_inference_request");
    expect(logged).toContain(
      '"outputValidation":{"failureCode":null,"status":"passed"}',
    );
    expect(logged).not.toContain("csv");
    expect(logged).not.toContain('"messages"');
    expect(logged).not.toContain("private submitted cell");
    expect(logged).not.toContain("responseContent");
  });

  it("logs a privacy-safe validation code without raw model output", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    emitInferenceRunEvents("evaluation-1", "failed", {
      outputValidation: {
        failureCode: "private_value_copy",
        status: "failed",
      },
      requestCount: { made: 1, maximum: 1 },
      requests: [
        {
          attempt: 1,
          billing: {
            inputCostNeuron: null,
            outputCostNeuron: null,
            totalCostNeuron: null,
          },
          durationMs: 12,
          finishReason: "stop",
          httpStatus: 200,
          model: "model",
          outcome: "succeeded",
          provider: "provider",
          reasoningContentPresent: false,
          requestId: "request",
          responseLength: 400,
          teeVerified: true,
          usage: {
            completionTokens: 20,
            promptTokens: 30,
            reasoningTokens: 0,
            totalTokens: 50,
          },
        },
      ],
    });

    const logged = String(info.mock.calls[0]?.[0]);
    expect(logged).toContain('"failureCode":"private_value_copy"');
    expect(logged).not.toContain("private submitted cell");
  });
});
