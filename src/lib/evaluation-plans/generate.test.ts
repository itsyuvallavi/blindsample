import { describe, expect, it, vi } from "vitest";

import type { ParsedCsvSample } from "../csv/parse-sample";
import { prepareSemanticRecords } from "../scoring/semantic";
import { scorePrivateCsvSample } from "../scoring/score-sample";
import type { VerifiedCompletion } from "../zero-g/client";
import {
  generateEvaluationPlan,
  generateFreshEvaluationPlans,
  validateGeneratedPlan,
} from "./generate";
import type {
  EvaluationQuestion,
  GeneratedEvaluationPlan,
} from "./types";

const BTC_SAMPLE: ParsedCsvSample = {
  columnCount: 8,
  columns: [
    "timestamp",
    "symbol",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "market_context",
  ],
  rowCount: 5,
  rows: [
    [
      "2026-07-26T10:00:00Z",
      "BTC",
      "118000",
      "118050",
      "117980",
      "118040",
      "12.5",
      "BTC rose as spot demand strengthened.",
    ],
    [
      "2026-07-26T10:01:00Z",
      "BTC",
      "118040",
      "118060",
      "118010",
      "118020",
      "9.1",
      "BTC consolidated after the earlier move.",
    ],
    [
      "2026-07-26T10:02:00Z",
      "BTC",
      "118020",
      "118080",
      "118000",
      "118070",
      "14.2",
      "BTC buying pressure lifted the close.",
    ],
    [
      "2026-07-26T10:03:00Z",
      "BTC",
      "118070",
      "118090",
      "118030",
      "118040",
      "11.8",
      "BTC pulled back as short-term traders sold.",
    ],
    [
      "2026-07-26T10:04:00Z",
      "BTC",
      "118040",
      "118120",
      "118030",
      "118110",
      "16.4",
      "BTC advanced with higher trading volume.",
    ],
  ],
};

const COMPLETENESS_QUESTION: EvaluationQuestion = {
  id: "btc_completeness",
  question:
    "What percentage of records contain timestamp, open, high, low, close, and volume values?",
};
const CONTEXT_QUESTION: EvaluationQuestion = {
  id: "btc_context",
  question:
    "Does each market context provide a plausible, BTC-specific explanation relevant to the price movement in that record?",
};

describe("submission-time evaluation planning", () => {
  it("maps the BTC completeness question to six real fields and calculates 100 in code", async () => {
    const plan = generateEvaluationPlan(
      COMPLETENESS_QUESTION,
      BTC_SAMPLE,
    );
    const requestCompletion = vi.fn();

    expect(plan).toMatchObject({
      method: "deterministic",
      relevantColumns: [
        "timestamp",
        "open",
        "high",
        "low",
        "close",
        "volume",
      ],
      status: "answerable",
    });
    expect(JSON.stringify(plan)).not.toContain('"message"');

    const scoring = await scorePrivateCsvSample([plan], BTC_SAMPLE, {
      requestCompletion,
    });

    expect(scoring.results).toEqual([
      expect.objectContaining({
        questionId: "btc_completeness",
        score: 100,
        status: "scored",
      }),
    ]);
    expect(scoring.results[0].evidence.method).toBe("deterministic");
    expect(requestCompletion).not.toHaveBeenCalled();
  });

  it("selects market context and BTC price evidence without customer-support defaults", () => {
    const plan = generateEvaluationPlan(CONTEXT_QUESTION, BTC_SAMPLE);

    expect(plan).toMatchObject({
      method: "semantic",
      relevantColumns: [
        "symbol",
        "open",
        "high",
        "low",
        "close",
        "market_context",
      ],
      status: "answerable",
    });
    expect(JSON.stringify(plan)).not.toContain('"message"');
    expect(JSON.stringify(plan).toLowerCase()).not.toContain(
      "customer support",
    );
  });

  it("invalidates a plan when its question changes", () => {
    const plan = generateEvaluationPlan(CONTEXT_QUESTION, BTC_SAMPLE);

    expect(
      validateGeneratedPlan(
        plan,
        {
          ...CONTEXT_QUESTION,
          question: "Does the CSV contain verified exchange names?",
        },
        BTC_SAMPLE,
      ),
    ).toMatchObject({
      reason: "question_changed",
      valid: false,
    });
  });

  it("creates a fresh plan when the submitted dataset changes", () => {
    const secondSample: ParsedCsvSample = {
      columnCount: 2,
      columns: ["symbol", "description"],
      rowCount: 2,
      rows: [
        ["BTC", "Bitcoin market explanation"],
        ["ETH", "Ethereum market explanation"],
      ],
    };
    const first = generateEvaluationPlan(
      CONTEXT_QUESTION,
      BTC_SAMPLE,
    );
    const second = generateEvaluationPlan(
      CONTEXT_QUESTION,
      secondSample,
    );

    expect(second.datasetFingerprint).not.toBe(
      first.datasetFingerprint,
    );
    expect(second.relevantColumns).not.toEqual(first.relevantColumns);
  });

  it("regenerates one invalid column plan using the real headers", () => {
    const generator = vi.fn(
      (
        question: EvaluationQuestion,
        sample: ParsedCsvSample,
        context: {
          attempt: 1 | 2;
          previousMissingColumns: string[];
        },
      ) => {
        const plan = generateEvaluationPlan(question, sample, context);

        if (context.attempt === 2 || plan.status === "unable") {
          return plan;
        }

        return {
          ...plan,
          contract: {
            ...plan.contract,
            criterion: {
              columns: ["message"],
              kind: "completeness",
            },
            requiredColumns: ["message"],
          },
          relevantColumns: ["message"],
        } as GeneratedEvaluationPlan;
      },
    );

    const [plan] = generateFreshEvaluationPlans(
      [COMPLETENESS_QUESTION],
      BTC_SAMPLE,
      generator,
    );

    expect(generator).toHaveBeenCalledTimes(2);
    expect(plan.generationAttempt).toBe(2);
    expect(plan.relevantColumns).not.toContain("message");
    expect(
      validateGeneratedPlan(plan, COMPLETENESS_QUESTION, BTC_SAMPLE),
    ).toEqual({ valid: true });
  });

  it("blocks an invalid plan before making any 0G request", async () => {
    const valid = generateEvaluationPlan(
      CONTEXT_QUESTION,
      BTC_SAMPLE,
    );

    if (valid.status !== "answerable") {
      throw new Error("Expected an answerable test plan.");
    }

    const invalid = {
      ...valid,
      contract: {
        ...valid.contract,
        criterion: {
          ...valid.contract.criterion,
          columns: ["message"],
        },
        requiredColumns: ["message"],
      },
      relevantColumns: ["message"],
    } as GeneratedEvaluationPlan;
    const requestCompletion = vi.fn();

    await expect(
      scorePrivateCsvSample([invalid], BTC_SAMPLE, {
        requestCompletion,
      }),
    ).rejects.toThrow("does not match the submitted CSV");
    expect(requestCompletion).not.toHaveBeenCalled();
  });

  it("calculates an auditable semantic score from private per-record judgments", async () => {
    const plan = generateEvaluationPlan(
      CONTEXT_QUESTION,
      BTC_SAMPLE,
    );

    if (
      plan.status !== "answerable" ||
      plan.method !== "semantic"
    ) {
      throw new Error("Expected a semantic test plan.");
    }

    const recordIds = prepareSemanticRecords(
      plan.contract,
      BTC_SAMPLE,
    ).map((record) => record.recordId);
    const requestCompletion = vi
      .fn()
      .mockResolvedValueOnce(completion(recordIds, "original"))
      .mockResolvedValueOnce(completion(recordIds, "repeat"));

    const scoring = await scorePrivateCsvSample([plan], BTC_SAMPLE, {
      maximumInferenceRequests: 2,
      requestCompletion,
    });

    expect(requestCompletion).toHaveBeenCalledTimes(2);
    expect(scoring.results[0]).toMatchObject({
      evidence: {
        agreement: { ratio: 1, status: "passed" },
        method: "semantic",
        measurement: {
          name: "mean_rubric_points",
          value: 100,
        },
        zeroG: { teeVerified: true },
      },
      questionId: "btc_context",
      score: 100,
      status: "scored",
    });
  });
});

function completion(
  recordIds: string[],
  requestId: string,
): VerifiedCompletion {
  return {
    content: JSON.stringify({
      classifications: recordIds.map((recordId) => ({
        label: "positive",
        recordId,
      })),
      controls: [
        { controlId: "control_a", label: "negative" },
        { controlId: "control_b", label: "positive" },
        { controlId: "control_c", label: "intermediate" },
      ],
    }),
    diagnostics: [
      {
        attempt: 1,
        billing: {
          inputCostNeuron: null,
          outputCostNeuron: null,
          totalCostNeuron: null,
        },
        durationMs: 10,
        finishReason: "stop",
        httpStatus: 200,
        outcome: "succeeded",
        reasoningContentPresent: false,
        responseLength: 100,
        usage: {
          completionTokens: 20,
          promptTokens: 10,
          reasoningTokens: 0,
          totalTokens: 30,
        },
      },
    ],
    trace: {
      model: "mock-private-model",
      provider: "mock-provider",
      requestId,
      teeVerified: true,
    },
  };
}
