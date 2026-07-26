import { describe, expect, it, vi } from "vitest";

import type { EvaluationRunDiagnostics } from "../scoring/run-diagnostics";
import { emitInferenceRunEvents } from "./inference";

describe("emitInferenceRunEvents", () => {
  it("logs only the bounded diagnostic allowlist", () => {
    const diagnostics: EvaluationRunDiagnostics = {
      requestCount: { made: 1, maximum: 2 },
      requests: [
        {
          attempt: 1,
          billing: {
            inputCostNeuron: "10",
            outputCostNeuron: "20",
            totalCostNeuron: "30",
          },
          durationMs: 12,
          finishReason: "stop",
          httpStatus: 200,
          model: "test-model",
          outcome: "succeeded",
          pass: "original",
          provider: "test-provider",
          questionId: "relevance",
          requestId: "request-1",
          responseLength: 80,
          teeVerified: true,
          usage: {
            completionTokens: 20,
            promptTokens: 10,
            reasoningTokens: 0,
            totalTokens: 30,
          },
        },
      ],
    };
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    emitInferenceRunEvents("evaluation-1", "complete", diagnostics);

    expect(info).toHaveBeenCalledTimes(1);
    const logged = String(info.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({
      evaluationId: "evaluation-1",
      event: "private_inference_request",
      finishReason: "stop",
      status: "complete",
      usage: { totalTokens: 30 },
    });
    expect(logged).not.toContain("messages");
    expect(logged).not.toContain("promptContent");
    expect(logged).not.toContain("responseContent");
    expect(logged).not.toContain("reasoningContent");

    info.mockRestore();
  });
});
