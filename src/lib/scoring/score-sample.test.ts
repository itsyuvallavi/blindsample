import { describe, expect, it, vi } from "vitest";

import { parseCsvSample } from "../csv/parse-sample";
import {
  ZeroGClientError,
  type VerifiedCompletion,
} from "../zero-g/client";
import {
  PrivateScoringError,
  scorePrivateCsvSample,
} from "./score-sample";

const SAMPLE = parseCsvSample(
  new TextEncoder().encode(
    [
      "timestamp,price,market_context",
      "2026-07-26T10:00:00Z,118000,Context one",
      "2026-07-26T10:01:00Z,118010,Context two",
    ].join("\n"),
  ),
);
const QUESTIONS = [
  {
    id: "complete",
    question:
      "What percentage of records contain timestamp and price values?",
  },
  {
    id: "context",
    question: "Is each market context relevant to its record?",
  },
];

describe("scorePrivateCsvSample", () => {
  it("sends the sample and all questions in exactly one 0G request", async () => {
    const requestCompletion = vi
      .fn()
      .mockResolvedValue(completion(validOutput()));

    const result = await scorePrivateCsvSample(
      {
        evaluationId: "evaluation-1",
        questions: QUESTIONS,
        sample: SAMPLE,
      },
      { requestCompletion },
    );

    expect(requestCompletion).toHaveBeenCalledTimes(1);
    const messages = requestCompletion.mock.calls[0][0];
    const serialized = JSON.stringify(messages);
    expect(serialized).toContain(QUESTIONS[0].question);
    expect(serialized).toContain(QUESTIONS[1].question);
    expect(serialized).toContain("118000");
    expect(result.inferenceRequests).toEqual({
      made: 1,
      maximum: 1,
    });
    expect(result.results.map((item) => item.questionId)).toEqual([
      "complete",
      "context",
    ]);
    expect(
      result.results.every(
        (item) =>
          item.provenance.evaluator === "0g" &&
          item.provenance.teeVerified,
      ),
    ).toBe(true);
  });

  it("still invokes 0G for an exact percentage question", async () => {
    const requestCompletion = vi
      .fn()
      .mockResolvedValue(
        completion({
          evaluation_id: "evaluation-1",
          results: [validOutput().results[0]],
        }),
      );

    await scorePrivateCsvSample(
      {
        evaluationId: "evaluation-1",
        questions: [QUESTIONS[0]],
        sample: SAMPLE,
      },
      { requestCompletion },
    );

    expect(requestCompletion).toHaveBeenCalledOnce();
  });

  it("turns a 401 into an atomic failure with no result set", async () => {
    const requestCompletion = vi.fn().mockRejectedValue(
      new ZeroGClientError(
        "Unauthorized.",
        "request_failed",
        401,
        [
          {
            attempt: 1,
            billing: {
              inputCostNeuron: null,
              outputCostNeuron: null,
              totalCostNeuron: null,
            },
            durationMs: 2,
            finishReason: null,
            httpStatus: 401,
            outcome: "http_error",
            reasoningContentPresent: null,
            responseLength: null,
            usage: {
              completionTokens: null,
              promptTokens: null,
              reasoningTokens: null,
              totalTokens: null,
            },
          },
        ],
      ),
    );

    const rejected = scorePrivateCsvSample(
      {
        evaluationId: "evaluation-1",
        questions: QUESTIONS,
        sample: SAMPLE,
      },
      { requestCompletion },
    );

    await expect(rejected).rejects.toBeInstanceOf(PrivateScoringError);
    await expect(rejected).rejects.toMatchObject({
      diagnostics: {
        requestCount: { made: 1, maximum: 1 },
        requests: [expect.objectContaining({ httpStatus: 401 })],
      },
    });
    expect(requestCompletion).toHaveBeenCalledOnce();
  });

  it.each([
    ["invalid JSON", completion("not json")],
    [
      "missing one question",
      completion({
        evaluation_id: "evaluation-1",
        results: [validOutput().results[0]],
      }),
    ],
    [
      "invented question",
      completion({
        evaluation_id: "evaluation-1",
        results: [
          validOutput().results[0],
          {
            ...validOutput().results[1],
            question_id: "invented",
          },
        ],
      }),
    ],
    [
      "invalid arithmetic",
      completion({
        evaluation_id: "evaluation-1",
        results: [
          {
            ...validOutput().results[0],
            numerator: 1,
            score: 100,
          },
          validOutput().results[1],
        ],
      }),
    ],
    [
      "missing count arithmetic",
      completion({
        evaluation_id: "evaluation-1",
        results: [
          {
            ...validOutput().results[0],
            denominator: null,
            numerator: null,
          },
          validOutput().results[1],
        ],
      }),
    ],
  ])("rejects %s without returning partial scores", async (_, response) => {
    const requestCompletion = vi.fn().mockResolvedValue(response);

    await expect(
      scorePrivateCsvSample(
        {
          evaluationId: "evaluation-1",
          questions: QUESTIONS,
          sample: SAMPLE,
        },
        { requestCompletion },
      ),
    ).rejects.toBeInstanceOf(PrivateScoringError);
    expect(requestCompletion).toHaveBeenCalledOnce();
  });

  it("rejects output that copies a private cell value into evidence", async () => {
    const output = validOutput();
    output.results[1].evidence.reasons = [
      "Copied Context one from the private sample.",
    ];

    await expect(
      scorePrivateCsvSample(
        {
          evaluationId: "evaluation-1",
          questions: QUESTIONS,
          sample: SAMPLE,
        },
        {
          requestCompletion: vi
            .fn()
            .mockResolvedValue(completion(output)),
        },
      ),
    ).rejects.toBeInstanceOf(PrivateScoringError);
  });

  it("fails when TEE verification is unavailable", async () => {
    const requestCompletion = vi.fn().mockRejectedValue(
      new ZeroGClientError(
        "Unverified.",
        "unverified_response",
        200,
        [
          {
            attempt: 1,
            billing: {
              inputCostNeuron: null,
              outputCostNeuron: null,
              totalCostNeuron: null,
            },
            durationMs: 4,
            finishReason: "stop",
            httpStatus: 200,
            outcome: "unverified_response",
            reasoningContentPresent: false,
            responseLength: 20,
            usage: {
              completionTokens: 5,
              promptTokens: 10,
              reasoningTokens: 0,
              totalTokens: 15,
            },
          },
        ],
      ),
    );

    await expect(
      scorePrivateCsvSample(
        {
          evaluationId: "evaluation-1",
          questions: QUESTIONS,
          sample: SAMPLE,
        },
        { requestCompletion },
      ),
    ).rejects.toMatchObject({
      diagnostics: {
        requests: [
          expect.objectContaining({
            outcome: "unverified_response",
            teeVerified: false,
          }),
        ],
      },
    });
  });
});

function validOutput() {
  return {
    evaluation_id: "evaluation-1",
    results: [
      {
        confidence: 100,
        denominator: 2,
        evaluation_basis: {
          description: "Records containing both required fields.",
          unit: "records",
        },
        evidence: {
          aggregate_counts: [
            { count: 2, label: "complete records" },
          ],
          reasons: ["All required fields were present."],
          row_numbers: [1, 2],
        },
        explanation: "Both submitted records contain the required fields.",
        numerator: 2,
        question_id: "complete",
        score: 100,
        score_definition: {
          one_hundred: "Every submitted record contains both fields.",
          zero: "No submitted record contains both fields.",
        },
        status: "scored",
      },
      {
        confidence: 80,
        denominator: null,
        evaluation_basis: {
          description: "A holistic relevance rubric across the records.",
          unit: "holistic_rubric",
        },
        evidence: {
          aggregate_counts: [
            { count: 2, label: "records evaluated" },
          ],
          reasons: ["The context was relevant to each row."],
          row_numbers: [1, 2],
        },
        explanation: "The submitted context was relevant overall.",
        numerator: null,
        question_id: "context",
        score: 75,
        score_definition: {
          one_hundred: "Every context is fully relevant.",
          zero: "No context is relevant.",
        },
        status: "scored",
      },
    ],
  };
}

function completion(content: unknown): VerifiedCompletion {
  const serialized =
    typeof content === "string" ? content : JSON.stringify(content);

  return {
    content: serialized,
    diagnostics: [
      {
        attempt: 1,
        billing: {
          inputCostNeuron: "1",
          outputCostNeuron: "2",
          totalCostNeuron: "3",
        },
        durationMs: 10,
        finishReason: "stop",
        httpStatus: 200,
        outcome: "succeeded",
        reasoningContentPresent: false,
        responseLength: serialized.length,
        usage: {
          completionTokens: 100,
          promptTokens: 200,
          reasoningTokens: 0,
          totalTokens: 300,
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
}
