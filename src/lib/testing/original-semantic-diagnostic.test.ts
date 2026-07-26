import { describe, expect, it, vi } from "vitest";

import type { ParsedCsvSample } from "../csv/parse-sample";
import { compileEvaluationContracts } from "../evaluation-contracts/compile";
import type { VerifiedCompletion } from "../zero-g/client";
import {
  prepareSemanticControls,
  prepareSemanticRecords,
} from "../scoring/semantic";
import { runOriginalSemanticDiagnostic } from "./original-semantic-diagnostic";

const CONTRACT = compileEvaluationContracts([
  {
    columns: ["message"],
    controls: {
      intermediate:
        "A customer asks a general question that may or may not need an agent.",
      negative: "A weather report with no support request.",
      positive: "A customer explicitly asks an agent to unlock an account.",
    },
    id: "support_relevance",
    kind: "semantic_relevance",
    question: "Does this require customer support?",
    target: "Customer requests that require a support agent to act.",
  },
])[0];

const SAMPLE: ParsedCsvSample = {
  columnCount: 1,
  columns: ["message"],
  rowCount: 3,
  rows: [
    ["Account locked"],
    ["Duplicate charge"],
    ["Dashboard unavailable"],
  ],
};

function completion(content: string): VerifiedCompletion {
  return {
    content,
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
        responseLength: content.length,
        usage: {
          completionTokens: 20,
          promptTokens: 100,
          reasoningTokens: 0,
          totalTokens: 120,
        },
      },
    ],
    trace: {
      model: "glm-test",
      provider: "provider",
      requestId: "request-1",
      teeVerified: true,
    },
  };
}

function validContent() {
  const records = prepareSemanticRecords(CONTRACT, SAMPLE);
  const controls = prepareSemanticControls(CONTRACT);

  return JSON.stringify({
    classifications: records.map((record) => ({
      label: "positive",
      recordId: record.recordId,
    })),
    controls: controls.map((control) => ({
      controlId: control.controlId,
      label: control.expectedLabel,
    })),
  });
}

describe("runOriginalSemanticDiagnostic", () => {
  it("makes exactly one original-pass request and reports safe evidence", async () => {
    const requestCompletion = vi
      .fn()
      .mockResolvedValue(completion(validContent()));

    const result = await runOriginalSemanticDiagnostic(
      CONTRACT,
      SAMPLE,
      requestCompletion,
    );

    expect(requestCompletion).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      classificationCount: { expected: 3, received: 3 },
      controlCheck: "passed",
      controlClassifications: [
        {
          controlId: "control_a",
          expectedLabel: "negative",
          passed: true,
          returnedLabel: "negative",
        },
        {
          controlId: "control_b",
          expectedLabel: "positive",
          passed: true,
          returnedLabel: "positive",
        },
        {
          controlId: "control_c",
          expectedLabel: "intermediate",
          passed: true,
          returnedLabel: "intermediate",
        },
      ],
      inferenceRequests: { made: 1, maximum: 1 },
      jsonModeRespected: true,
      reason: null,
      requests: [
        {
          pass: "original",
          reasoningContentPresent: false,
          teeVerified: true,
          usage: { reasoningTokens: 0 },
        },
      ],
      semanticFailure: null,
      status: "parsed",
      strictSchemaParsed: true,
      thinkingDisabledObserved: true,
    });
  });

  it("does not retry when the one response cannot be parsed", async () => {
    const requestCompletion = vi
      .fn()
      .mockResolvedValue(completion("```json\n{}\n```"));

    const result = await runOriginalSemanticDiagnostic(
      CONTRACT,
      SAMPLE,
      requestCompletion,
    );

    expect(requestCompletion).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      controlClassifications: null,
      inferenceRequests: { made: 1, maximum: 1 },
      jsonModeRespected: false,
      reason: "semantic_output_invalid_json",
      requests: [{ pass: "original", responseLength: 14 }],
      semanticFailure: { kind: "invalid_json", pass: "original" },
      status: "unable_to_parse",
      strictSchemaParsed: false,
    });
  });

  it("reports the returned control label without retaining control text", async () => {
    const content = JSON.parse(validContent()) as {
      controls: Array<{ controlId: string; label: string }>;
    };
    const intermediate = content.controls.find(
      ({ controlId }) => controlId === "control_c",
    );

    if (!intermediate) {
      throw new Error("Expected the intermediate control fixture.");
    }

    intermediate.label = "negative";
    const requestCompletion = vi
      .fn()
      .mockResolvedValue(completion(JSON.stringify(content)));

    const result = await runOriginalSemanticDiagnostic(
      CONTRACT,
      SAMPLE,
      requestCompletion,
    );

    expect(result).toMatchObject({
      controlCheck: "failed",
      controlClassifications: [
        {
          controlId: "control_a",
          expectedLabel: "negative",
          passed: true,
          returnedLabel: "negative",
        },
        {
          controlId: "control_b",
          expectedLabel: "positive",
          passed: true,
          returnedLabel: "positive",
        },
        {
          controlId: "control_c",
          expectedLabel: "intermediate",
          passed: false,
          returnedLabel: "negative",
        },
      ],
      reason: "control_check_failed",
      status: "parsed",
      strictSchemaParsed: true,
    });
    expect(JSON.stringify(result)).not.toContain(
      CONTRACT.criterion.kind === "semantic_relevance"
        ? CONTRACT.criterion.controls.intermediate
        : "",
    );
  });
});
