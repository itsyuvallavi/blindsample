import { describe, expect, it } from "vitest";

import type { InferenceRequestAudit } from "./run-diagnostics";
import {
  normalizeLegacyExecutionErrors,
} from "./execution-error";
import type { EvaluationResult } from "./types";

const LEGACY_FAILURE = {
  evidence: {
    agreement: {
      ratio: null,
      requiredRatio: null,
      status: "not_applicable",
    },
    contractVersion: "2.0.0",
    controlCheck: "not_applicable",
    coverageRatio: 0,
    limitation: "Submitted sample only.",
    measurement: null,
    method: "semantic",
    recordsEvaluated: 0,
    recordsSubmitted: 5,
    semanticFailure: null,
    zeroG: null,
  },
  questionId: "market_context",
  reason: "model_or_verification_failed",
  score: null,
  status: "unable_to_score",
} satisfies EvaluationResult;

const UNAUTHORIZED_REQUEST = {
  attempt: 1,
  billing: {
    inputCostNeuron: null,
    outputCostNeuron: null,
    totalCostNeuron: null,
  },
  durationMs: 93,
  finishReason: null,
  httpStatus: 401,
  model: null,
  outcome: "http_error",
  pass: "original",
  provider: null,
  questionId: "market_context",
  reasoningContentPresent: null,
  requestId: null,
  responseLength: null,
  teeVerified: null,
  usage: {
    completionTokens: null,
    promptTokens: null,
    reasoningTokens: null,
    totalTokens: null,
  },
} satisfies InferenceRequestAudit;

describe("normalizeLegacyExecutionErrors", () => {
  it("turns a stored provider failure into an error without 0% evidence", () => {
    expect(
      normalizeLegacyExecutionErrors(
        [LEGACY_FAILURE],
        [UNAUTHORIZED_REQUEST],
      ),
    ).toEqual([
      expect.objectContaining({
        error: {
          code: "private_compute_authentication_failed",
          httpStatus: 401,
          outcome: "http_error",
          requestMade: true,
        },
        evidence: expect.objectContaining({
          coverageRatio: null,
          recordsEvaluated: null,
        }),
        score: null,
        status: "error",
      }),
    ]);
  });
});
