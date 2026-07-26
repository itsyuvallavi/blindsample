import { describe, expect, it } from "vitest";

import type { PrivateScoringResult } from "../scoring/score-sample";
import { buildLiveSemanticSummary } from "./live-semantic-summary";

describe("buildLiveSemanticSummary", () => {
  it("exposes failure evidence and request metadata without private content", () => {
    const result = {
      diagnostics: {
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
            model: "glm-test",
            outcome: "succeeded",
            pass: "original",
            provider: "provider",
            questionId: "semantic",
            reasoningContentPresent: false,
            requestId: "request-1",
            responseLength: 0,
            teeVerified: true,
            usage: {
              completionTokens: 0,
              promptTokens: 100,
              reasoningTokens: 0,
              totalTokens: 100,
            },
          },
        ],
      },
      inferenceRequests: { made: 1, maximum: 2 },
      results: [
        {
          evidence: {
            agreement: {
              ratio: null,
              requiredRatio: 0.8,
              status: "not_applicable",
            },
            contractVersion: "1.0.0",
            controlCheck: "failed",
            coverageRatio: 0,
            limitation: "Submitted-data limitation.",
            measurement: null,
            method: "semantic",
            recordsEvaluated: 0,
            recordsSubmitted: 5,
            semanticFailure: {
              kind: "empty",
              pass: "original",
            },
            zeroG: {
              requests: [
                {
                  model: "glm-test",
                  provider: "provider",
                  requestId: "request-1",
                  teeVerified: true,
                },
              ],
              teeVerified: true,
            },
          },
          questionId: "semantic",
          reason: "semantic_output_empty",
          score: null,
          status: "unable_to_score",
        },
      ],
      semanticVerification: "verified",
    } satisfies PrivateScoringResult;

    const summary = buildLiveSemanticSummary(result, "semantic");
    const serialized = JSON.stringify(summary);

    expect(summary).toMatchObject({
      inferenceRequests: { made: 1, maximum: 2 },
      requests: [
        {
          finishReason: "stop",
          httpStatus: 200,
          pass: "original",
          reasoningContentPresent: false,
          usage: { reasoningTokens: 0 },
        },
      ],
      semantic: {
        controlCheck: "failed",
        reason: "semantic_output_empty",
        semanticFailure: { kind: "empty", pass: "original" },
        status: "unable_to_score",
      },
    });
    expect(serialized).not.toContain("promptContent");
    expect(serialized).not.toContain("submittedDataRecords");
    expect(serialized).not.toContain("rawOutput");
  });
});
