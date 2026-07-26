import { afterEach, describe, expect, it } from "vitest";

import { compileEvaluationContracts } from "../evaluation-contracts/compile";
import { hashEvaluationQuestions } from "../evaluation-contracts/hash";
import {
  fingerprintQuestion,
  fingerprintSample,
} from "../evaluation-plans/generate";
import {
  EVALUATION_PLAN_VERSION,
  type GeneratedEvaluationPlan,
} from "../evaluation-plans/types";
import { getSupabaseServerClient } from "./client";
import {
  beginSellerSubmission,
  completeEvaluation,
  createEvaluation,
  getBuyerEvaluation,
  getSellerEvaluation,
} from "./evaluations";

const describeLive =
  process.env.SUPABASE_LIVE === "1" ? describe : describe.skip;
const createdIds: string[] = [];
const CONTRACTS = compileEvaluationContracts([
  {
    columns: ["order_total"],
    id: "complete",
    kind: "completeness",
    question: "Are order totals complete?",
  },
  {
    columns: ["description"],
    controls: {
      intermediate: "A possible order note with limited detail.",
      negative: "A weather report unrelated to orders.",
      positive: "A confirmed customer order description.",
    },
    id: "relevance",
    kind: "semantic_relevance",
    question: "Are these customer order records?",
    target: "Records that clearly describe customer orders.",
  },
]);
const QUESTIONS = CONTRACTS.map((contract) => ({
  id: contract.questionId,
  question: contract.originalQuestion,
}));
const AUDIT_SAMPLE = {
  columnCount: 2,
  columns: ["order_total", "description"],
  rowCount: 1,
  rows: [["10", "Confirmed customer order"]],
};
const PLANS: GeneratedEvaluationPlan[] = CONTRACTS.map((contract) => ({
  confidence: 1,
  contract,
  datasetFingerprint: fingerprintSample(AUDIT_SAMPLE),
  evidenceNeeded: contract.requiredEvidence,
  explanation: "Live persistence plan.",
  generationAttempt: 1,
  method: contract.method,
  originalQuestion: contract.originalQuestion,
  planVersion: EVALUATION_PLAN_VERSION,
  questionFingerprint: fingerprintQuestion({
    id: contract.questionId,
    question: contract.originalQuestion,
  }),
  questionId: contract.questionId,
  relevantColumns: contract.requiredColumns,
  scoreMeaning: {
    one: contract.scoringAnchors["1"],
    oneHundred: contract.scoringAnchors["100"],
  },
  status: "answerable",
  unableReason: null,
}));

describeLive("live Supabase evaluation persistence", () => {
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
      throw new Error("Live test cleanup failed.", { cause: error });
    }
  });

  it("separates roles and permits exactly one submission claim", async () => {
    const created = await createEvaluation({
      questions: QUESTIONS,
      questionSetHash: hashEvaluationQuestions(QUESTIONS),
      title: "Live persistence verification",
    });
    createdIds.push(created.id);

    const [sellerView, buyerView, sellerWithBuyerToken, buyerWithSellerToken] =
      await Promise.all([
        getSellerEvaluation(created.id, created.sellerToken),
        getBuyerEvaluation(created.id, created.buyerToken),
        getSellerEvaluation(created.id, created.buyerToken),
        getBuyerEvaluation(created.id, created.sellerToken),
      ]);

    expect(sellerView?.status).toBe("waiting_for_seller");
    expect(buyerView?.results).toBeNull();
    expect(sellerWithBuyerToken).toBeNull();
    expect(buyerWithSellerToken).toBeNull();

    const claims = await Promise.all([
      beginSellerSubmission({
        id: created.id,
        sampleColumnCount: 4,
        sampleRowCount: 12,
        token: created.sellerToken,
      }),
      beginSellerSubmission({
        id: created.id,
        sampleColumnCount: 4,
        sampleRowCount: 12,
        token: created.sellerToken,
      }),
    ]);

    expect(claims.sort()).toEqual([false, true]);

    await completeEvaluation(created.id, {
      inferenceDiagnostics: {
        requestCount: { made: 1, maximum: 6 },
        requests: [
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
            model: "live-test-model",
            outcome: "succeeded",
            pass: "original",
            provider: "live-test-provider",
            questionId: "relevance",
            reasoningContentPresent: false,
            requestId: "live-test-request",
            responseLength: 100,
            teeVerified: true,
            usage: {
              completionTokens: 20,
              promptTokens: 10,
              reasoningTokens: 0,
              totalTokens: 30,
            },
          },
        ],
      },
      plans: PLANS,
      results: [
        {
          evidence: {
            agreement: {
              ratio: null,
              requiredRatio: null,
              status: "not_applicable",
            },
            contractVersion: "1.0.0",
            controlCheck: "not_applicable",
            coverageRatio: 1,
            limitation:
              "This result describes only the submitted records.",
            measurement: {
              name: "completeness_rate",
              unit: "percent",
              value: 91,
            },
            method: "deterministic",
            recordsEvaluated: 12,
            recordsSubmitted: 12,
            semanticFailure: null,
            zeroG: null,
          },
          questionId: "complete",
          score: 91,
          status: "scored",
        },
        {
          evidence: {
            agreement: {
              ratio: 1,
              requiredRatio: 0.8,
              status: "passed",
            },
            contractVersion: "1.0.0",
            controlCheck: "passed",
            coverageRatio: 1,
            limitation:
              "This result describes only the submitted records.",
            measurement: {
              name: "mean_rubric_points",
              unit: "rubric_points",
              value: 75,
            },
            method: "semantic",
            recordsEvaluated: 12,
            recordsSubmitted: 12,
            semanticFailure: null,
            zeroG: {
              requests: [
                {
                  model: "live-test-model",
                  provider: "live-test-provider",
                  requestId: "live-test-request",
                  teeVerified: true,
                },
              ],
              teeVerified: true,
            },
          },
          questionId: "relevance",
          score: 75,
          status: "scored",
        },
      ],
      sampleColumnCount: 4,
      sampleRowCount: 12,
    });

    const completedBuyerView = await getBuyerEvaluation(
      created.id,
      created.buyerToken,
    );
    const completedSellerView = await getSellerEvaluation(
      created.id,
      created.sellerToken,
    );

    expect(completedBuyerView).toMatchObject({
      results: [
        { questionId: "complete", score: 91 },
        { questionId: "relevance", score: 75 },
      ],
      status: "complete",
    });
    expect(completedSellerView).not.toHaveProperty("results");

    const { data: stored, error } = await getSupabaseServerClient()
      .from("evaluations")
      .select("buyer_token_hash, seller_token_hash")
      .eq("id", created.id)
      .single();

    expect(error).toBeNull();
    expect(stored?.buyer_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.seller_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(created.buyerToken);
    expect(JSON.stringify(stored)).not.toContain(created.sellerToken);
  });
});
