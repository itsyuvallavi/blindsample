import { afterEach, describe, expect, it } from "vitest";

import { getSupabaseServerClient } from "./client";
import {
  beginSellerSubmission,
  completeEvaluation,
  createEvaluation,
  getBuyerEvaluation,
} from "./evaluations";

const describeLive =
  process.env.SUPABASE_LIVE === "1" ? describe : describe.skip;
const createdIds: string[] = [];

describeLive("Supabase atomic evaluation persistence", () => {
  afterEach(async () => {
    if (createdIds.length === 0) {
      return;
    }

    const ids = createdIds.splice(0);
    const { error } = await getSupabaseServerClient()
      .from("evaluations")
      .delete()
      .in("id", ids);

    if (error) {
      throw new Error("Live persistence cleanup failed.", {
        cause: error,
      });
    }
  });

  it("stores only a complete verified 0G result set", async () => {
    const created = await createEvaluation({
      questions: [{ id: "q1", question: "Is this useful?" }],
      questionSetHash: "a".repeat(64),
      title: "Live persistence check",
    });
    createdIds.push(created.id);

    await expect(
      beginSellerSubmission({
        id: created.id,
        sampleColumnCount: 1,
        sampleRowCount: 1,
        token: created.sellerToken,
      }),
    ).resolves.toBe(true);

    const diagnostics = {
      requestCount: { made: 1 as const, maximum: 1 as const },
      requests: [
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
          model: "test-model",
          outcome: "succeeded" as const,
          provider: "test-provider",
          reasoningContentPresent: false,
          requestId: "request-1",
          responseLength: 100,
          teeVerified: true,
          usage: {
            completionTokens: 10,
            promptTokens: 20,
            reasoningTokens: 0,
            totalTokens: 30,
          },
        },
      ],
    };

    await completeEvaluation(created.id, {
      inferenceDiagnostics: diagnostics,
      questionIds: ["q1"],
      results: [
        {
          confidence: 80,
          denominator: null,
          evaluationBasis: {
            description: "A holistic rubric.",
            unit: "holistic_rubric",
          },
          evidence: {
            aggregateCounts: [{ count: 1, label: "record evaluated" }],
            reasons: ["The record was evaluated."],
            rowNumbers: [1],
          },
          explanation: "The record met most of the stated rubric.",
          numerator: null,
          provenance: {
            evaluator: "0g",
            model: "test-model",
            provider: "test-provider",
            requestId: "request-1",
            teeVerified: true,
          },
          questionId: "q1",
          resultVersion: "3.0.0",
          score: 75,
          scoreDefinition: {
            oneHundred: "The record fully meets the rubric.",
            zero: "The record does not meet the rubric.",
          },
          status: "scored",
        },
      ],
      sampleColumnCount: 1,
      sampleRowCount: 1,
    });

    const buyer = await getBuyerEvaluation(
      created.id,
      created.buyerToken,
    );
    expect(buyer).toMatchObject({
      status: "complete",
      results: [
        {
          evaluatedBy: "0g",
          questionId: "q1",
          score: 75,
          teeVerified: true,
        },
      ],
      verifiedComplete: true,
    });
    expect(buyer).not.toHaveProperty("sampleRowCount");
    expect(buyer).not.toHaveProperty("sampleColumnCount");
  });
});
