import { describe, expect, it } from "vitest";

import type { VerifiedCompletion } from "../zero-g/client";
import { diagnosticsFromCompletion } from "./run-diagnostics";

describe("evaluation run diagnostics", () => {
  it("retains only allowlisted metadata from one completion", () => {
    const completion: VerifiedCompletion = {
      content: "private model response",
      diagnostics: [
        {
          attempt: 1,
          billing: {
            inputCostNeuron: "10",
            outputCostNeuron: "20",
            totalCostNeuron: "30",
          },
          durationMs: 10,
          finishReason: "stop",
          httpStatus: 200,
          outcome: "succeeded",
          reasoningContentPresent: false,
          responseLength: 22,
          usage: {
            completionTokens: 20,
            promptTokens: 10,
            reasoningTokens: 0,
            totalTokens: 30,
          },
        },
      ],
      trace: {
        model: "test-model",
        provider: "test-provider",
        requestId: "request-1",
        teeVerified: true,
      },
    };

    const snapshot = diagnosticsFromCompletion(completion);
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.requestCount).toEqual({ made: 1, maximum: 1 });
    expect(snapshot.outputValidation).toEqual({
      failureCode: null,
      status: "not_run",
    });
    expect(snapshot.requests[0]).toMatchObject({
      finishReason: "stop",
      requestId: "request-1",
      usage: { totalTokens: 30 },
    });
    expect(serialized).not.toContain("private model response");
    expect(serialized).not.toContain("content");
  });
});
