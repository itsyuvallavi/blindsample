import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { readCapabilityToken } from "../browser/capability";
import { getSupabaseServerClient } from "../supabase/client";
import { paidLiveEnabled } from "../testing/paid-live";
import { getZeroGConfig } from "../zero-g/client";
import type { EvaluationResult } from "../scoring/types";
import {
  handleCreateEvaluation,
  handleGetEvaluation,
  handleSubmitEvaluation,
} from "./evaluations";

type ExpectedScore = {
  exact?: number;
  maximum?: number;
  minimum?: number;
};

type ScenarioQuestion = {
  expected: ExpectedScore;
  id: string;
  question: string;
};

type LiveScenario = {
  csv: string;
  id: string;
  questions: ScenarioQuestion[];
  title: string;
};

const describeLive =
  paidLiveEnabled("END_TO_END_LIVE") ? describe.sequential : describe.skip;
const createdIds: string[] = [];
const allScenarios: LiveScenario[] = [
  {
    id: "btc-market-quality",
    title: "BTC market quality",
    csv: [
      "timestamp,symbol,open,high,low,close,volume,market_context",
      "2026-07-26T10:00:00Z,BTC,118000,118100,117900,118050,42,Spot Bitcoin ETF inflows increased demand",
      "2026-07-26T10:01:00Z,BTC,118050,118070,117980,118000,31,Broad risk-off sentiment affected markets",
      "2026-07-26T10:02:00Z,BTC,118000,118020,117950,117970,27,A software update improved the mobile app",
      "2026-07-26T10:03:00Z,BTC,117970,118060,117960,118040,,Bitcoin miners reduced exchange deposits",
      "2026-07-26T10:04:00Z,BTC,118040,118090,118000,118080,36,No context available",
    ].join("\n"),
    questions: [
      {
        id: "required_fields",
        question:
          "What percentage of records contain timestamp, open, high, low, close, and volume values?",
        expected: { exact: 80 },
      },
      {
        id: "btc_specific_context",
        question:
          "What percentage of market_context values explicitly identify a Bitcoin-specific market driver rather than generic commentary?",
        expected: { exact: 40 },
      },
    ],
  },
  {
    id: "timestamp-integrity",
    title: "Timestamp integrity",
    csv: [
      "timestamp,value",
      "2026-07-26T10:00:00Z,10",
      "2026-07-26T10:01:00Z,11",
      "2026-07-26T10:01:00Z,12",
      "not-a-date,13",
      "2026-07-26T10:04:00Z,14",
    ].join("\n"),
    questions: [
      {
        id: "unique_timestamps",
        question:
          "What percentage of records have a timestamp that appears exactly once in the submitted sample?",
        expected: { exact: 60 },
      },
      {
        id: "valid_iso_dates",
        question:
          "What percentage of timestamp values are valid ISO 8601 dates?",
        expected: { exact: 80 },
      },
    ],
  },
  {
    id: "inventory-validity",
    title: "Inventory validity",
    csv: [
      "sku,quantity",
      "A-1,10",
      "B-2,-2",
      "C-3,abc",
      ",0",
      "E-5,5",
      "F-6,",
    ].join("\n"),
    questions: [
      {
        id: "sku_present",
        question:
          "What percentage of records contain a non-empty sku?",
        expected: { exact: 83 },
      },
      {
        id: "valid_quantity",
        question:
          "What percentage of quantity values are numeric and greater than or equal to zero?",
        expected: { exact: 50 },
      },
    ],
  },
  {
    id: "lead-contact-quality",
    title: "Lead contact quality",
    csv: [
      "email,country",
      "a@example.com,Portugal",
      "not-an-email,Spain",
      "b@test.org,",
      ",France",
      "c@company.io,Germany",
    ].join("\n"),
    questions: [
      {
        id: "valid_email",
        question:
          "What percentage of records contain a syntactically plausible email address?",
        expected: { exact: 60 },
      },
      {
        id: "country_present",
        question:
          "What percentage of records contain a non-empty country?",
        expected: { exact: 80 },
      },
    ],
  },
  {
    id: "btc-minute-coverage",
    title: "BTC minute coverage",
    csv: [
      "timestamp,btc_usd",
      "2026-07-26T10:00:00Z,118000",
      "2026-07-26T10:01:00Z,118010",
      "2026-07-26T10:03:00Z,118030",
      "2026-07-26T10:05:00Z,",
      "2026-07-26T10:08:00Z,118080",
      "2026-07-26T10:09:00Z,118090",
    ].join("\n"),
    questions: [
      {
        id: "minute_coverage",
        question:
          "I need exactly one numeric BTC/USD price for every minute from 10:00 through 10:09 UTC inclusive. Calculate the score as valid required timestamps divided by 10 times 100.",
        expected: { exact: 50 },
      },
      {
        id: "numeric_prices",
        question:
          "What percentage of submitted records contain a numeric btc_usd value?",
        expected: { exact: 83 },
      },
    ],
  },
  {
    id: "order-financial-validity",
    title: "Order financial validity",
    csv: [
      "order_id,order_total,currency",
      "O-1,125.50,USD",
      "O-2,0,EUR",
      "O-3,-4,usd",
      "O-4,88,US",
      "O-5,,",
    ].join("\n"),
    questions: [
      {
        id: "positive_totals",
        question:
          "What percentage of order_total values are numeric and strictly greater than zero?",
        expected: { exact: 40 },
      },
      {
        id: "currency_format",
        question:
          "What percentage of currency values contain exactly three uppercase letters?",
        expected: { exact: 40 },
      },
    ],
  },
  {
    id: "delivery-consistency",
    title: "Delivery consistency",
    csv: [
      "tracking_id,shipped_at,delivered_at",
      "A1,2026-07-20T10:00:00Z,2026-07-20T12:00:00Z",
      "A2,2026-07-20T12:00:00Z,2026-07-20T11:00:00Z",
      "A2,2026-07-20T10:00:00Z,",
      ",2026-07-20T10:00:00Z,2026-07-20T10:00:00Z",
      "A5,2026-07-20T10:00:00Z,not-a-date",
    ].join("\n"),
    questions: [
      {
        id: "delivery_order",
        question:
          "What percentage of records have valid shipped_at and delivered_at dates where delivered_at is on or after shipped_at?",
        expected: { exact: 40 },
      },
      {
        id: "unique_tracking",
        question:
          "What percentage of records contain a non-empty tracking_id that appears exactly once in the submitted sample?",
        expected: { exact: 40 },
      },
    ],
  },
  {
    id: "support-message-quality",
    title: "Support message quality",
    csv: [
      "message",
      "I cannot reset my password after completing verification.",
      "I love the new dashboard design.",
      "I was charged twice for the same subscription renewal.",
      "The clouds are bright today.",
      "Please close my account before the next renewal.",
    ].join("\n"),
    questions: [
      {
        id: "support_request",
        question:
          "What percentage of messages clearly describe a customer-support request requiring an agent response?",
        expected: { exact: 60 },
      },
      {
        id: "actionable_detail",
        question:
          "What percentage of messages state a concrete account, payment, or access problem or requested action?",
        expected: { exact: 60 },
      },
    ],
  },
  {
    id: "catalog-quality",
    title: "Catalog quality",
    csv: [
      "product_id,description,price",
      "P1,Insulated bottle keeps drinks cold for twelve hours,19.99",
      "P2,High quality item,-1",
      "P3,,0",
      "P4,USB-C hub adds HDMI and three USB ports,8.50",
      "P5,Notebook with numbered pages for lab records,",
    ].join("\n"),
    questions: [
      {
        id: "specific_description",
        question:
          "What percentage of descriptions state a specific product function or concrete use rather than generic praise?",
        expected: { exact: 60 },
      },
      {
        id: "positive_price",
        question:
          "What percentage of price values are numeric and strictly greater than zero?",
        expected: { exact: 40 },
      },
    ],
  },
  {
    id: "transaction-validity",
    title: "Transaction validity",
    csv: [
      "transaction_id,amount,currency",
      "T1,10,USD",
      "T2,200,EUR",
      "T3,-5,GBP",
      "T4,abc,US",
      "T5,30,usd",
      "T6,0,",
    ].join("\n"),
    questions: [
      {
        id: "positive_amount",
        question:
          "What percentage of amount values are numeric and strictly greater than zero?",
        expected: { exact: 50 },
      },
      {
        id: "valid_currency",
        question:
          "What percentage of currency values contain exactly three uppercase letters?",
        expected: { exact: 50 },
      },
    ],
  },
];
const difficulty = readDifficulty(process.env.E2E_DIFFICULTY);
const scenarioIdsByDifficulty = {
  baseline: [
    "btc-market-quality",
    "timestamp-integrity",
    "inventory-validity",
  ],
  hard: [
    "btc-minute-coverage",
    "support-message-quality",
    "catalog-quality",
  ],
} as const;
const selectedScenarioIds =
  difficulty === "full"
    ? null
    : new Set<string>(scenarioIdsByDifficulty[difficulty]);
const difficultyScenarios =
  selectedScenarioIds === null
    ? allScenarios
    : allScenarios.filter((scenario) =>
        selectedScenarioIds.has(scenario.id),
      );
const requestedScenarioId = process.env.E2E_SCENARIO_ID?.trim();
const scenarios = requestedScenarioId
  ? difficultyScenarios.filter(
      (scenario) => scenario.id === requestedScenarioId,
    )
  : difficultyScenarios;

if (requestedScenarioId && scenarios.length !== 1) {
  throw new Error(
    "E2E_SCENARIO_ID must identify exactly one scenario in the selected difficulty.",
  );
}
let inferenceRequestCount = 0;
let completedScenarioCount = 0;
let matchedScoreCount = 0;
let originalFetch: typeof globalThis.fetch;
let scoreCheckCount = 0;

describeLive(`${difficulty} live evaluation API flows`, () => {
  beforeAll(() => {
    originalFetch = globalThis.fetch;
    const endpoint = `${getZeroGConfig().baseUrl}/chat/completions`;

    globalThis.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === endpoint) {
        if (inferenceRequestCount >= scenarios.length) {
          throw new Error(
            `The live E2E request guard blocked inference request ${
              scenarios.length + 1
            }.`,
          );
        }

        inferenceRequestCount += 1;
      }

      return originalFetch(input, init);
    };
  });

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
      throw new Error("Live end-to-end cleanup failed.", {
        cause: error,
      });
    }
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    console.info(
      JSON.stringify({
        completedScenarios: completedScenarioCount,
        difficulty,
        event: "live_e2e_summary",
        expectedScoresMatched: matchedScoreCount,
        expectedScoresTested: scoreCheckCount,
        inferenceRequests: inferenceRequestCount,
        maximumInferenceRequests: scenarios.length,
        scenarios: scenarios.length,
      }),
    );
    expect(inferenceRequestCount).toBe(scenarios.length);
  });

  it.each(scenarios)(
    "$id publishes verified, accurate results",
    async (scenario) => {
      const questions = scenario.questions.map((question) => ({
        id: question.id,
        question: question.question,
      }));
      const createResponse = await handleCreateEvaluation(
        jsonRequest("/api/evaluations", {
          questions,
          title: scenario.title,
        }),
      );
      expect(createResponse.status).toBe(201);

      const created = (await createResponse.json()) as {
        buyerPath: string;
        evaluationId: string;
        sellerPath: string;
      };
      createdIds.push(created.evaluationId);

      const buyerToken = tokenFromPath(created.buyerPath);
      const sellerToken = tokenFromPath(created.sellerPath);
      expect(buyerToken).not.toBe(sellerToken);

      const form = new FormData();
      form.set(
        "sample",
        new File([scenario.csv], `${scenario.id}.csv`, {
          type: "text/csv",
        }),
      );

      const submitResponse = await handleSubmitEvaluation(
        new Request(
          `http://localhost/api/evaluations/${created.evaluationId}/submit`,
          {
            body: form,
            headers: {
              Authorization: `Bearer ${sellerToken}`,
            },
            method: "POST",
          },
        ),
        created.evaluationId,
      );

      if (submitResponse.status !== 200) {
        const failedResponse = await handleGetEvaluation(
          authorizedRead(created.evaluationId, buyerToken),
          created.evaluationId,
        );
        const failedView = (await failedResponse.json()) as {
          evaluation?: {
            errorCode?: string | null;
            inferenceDiagnostics?: unknown;
          };
        };

        console.info(
          JSON.stringify({
            errorCode:
              failedView.evaluation?.errorCode ?? "unavailable",
            inferenceDiagnostics:
              failedView.evaluation?.inferenceDiagnostics ?? null,
            scenario: scenario.id,
            submitStatus: submitResponse.status,
          }),
        );
        throw new Error(
          `Live scenario ${scenario.id} returned ${submitResponse.status}.`,
        );
      }

      const buyerResponse = await handleGetEvaluation(
        authorizedRead(created.evaluationId, buyerToken),
        created.evaluationId,
      );
      const { data: stored, error: storedError } =
        await getSupabaseServerClient()
          .from("evaluations")
          .select("results")
          .eq("id", created.evaluationId)
          .single();

      if (storedError) {
        throw new Error("Unable to read safe stored test results.", {
          cause: storedError,
        });
      }

      const safeModelResults = Array.isArray(stored.results)
        ? (stored.results as unknown as EvaluationResult[]).map(
            (result) => ({
              confidence: result.confidence,
              denominator: result.denominator,
              evaluationBasis: result.evaluationBasis.unit,
              explanation: result.explanation,
              numerator: result.numerator,
              questionId: result.questionId,
              score: result.score,
              status: result.status,
            }),
          )
        : [];
      const buyerView = (await buyerResponse.json()) as {
        evaluation: {
          inferenceDiagnostics: {
            requestCount: {
              made: number;
              maximum: number;
            };
            requests: Array<{
              finishReason: string | null;
              httpStatus: number | null;
              usage: {
                completionTokens: number | null;
                promptTokens: number | null;
                totalTokens: number | null;
              };
            }>;
          };
          results: Array<{
            confidence: number;
            evaluatedBy: string;
            explanation: string;
            questionId: string;
            score: number | null;
            status: string;
            teeVerified: boolean;
          }>;
          status: string;
        };
        role: string;
      };

      expect(buyerView.role).toBe("buyer");
      expect(buyerView.evaluation.status).toBe("complete");
      expect(buyerView.evaluation.results).toHaveLength(
        questions.length,
      );
      expect(
        buyerView.evaluation.inferenceDiagnostics.requestCount,
      ).toEqual({ made: 1, maximum: 1 });
      expect(
        buyerView.evaluation.inferenceDiagnostics.requests,
      ).toHaveLength(1);
      expect(
        buyerView.evaluation.results.map((result) => result.questionId),
      ).toEqual(questions.map((question) => question.id));

      const reportedResults = buyerView.evaluation.results.map(
        (result) => ({
          confidence: result.confidence,
          expected: scenario.questions.find(
            (question) => question.id === result.questionId,
          )?.expected,
          questionId: result.questionId,
          score: result.score,
          status: result.status,
        }),
      );

      console.info(
        JSON.stringify({
          diagnostics:
            buyerView.evaluation.inferenceDiagnostics.requests[0],
          results: reportedResults,
          safeModelResults,
          scenario: scenario.id,
        }),
      );

      for (const result of buyerView.evaluation.results) {
        const expected = scenario.questions.find(
          (question) => question.id === result.questionId,
        )?.expected;

        expect(result.status).toBe("scored");
        expect(result.evaluatedBy).toBe("0g");
        expect(result.teeVerified).toBe(true);
        expect(result.score).not.toBeNull();

        if (expected && result.score !== null) {
          scoreCheckCount += 1;
          expectScore(result.score, expected);
          matchedScoreCount += 1;
        }
      }

      const sellerResponse = await handleGetEvaluation(
        authorizedRead(created.evaluationId, sellerToken),
        created.evaluationId,
      );
      const sellerView = await sellerResponse.json();
      expect(sellerView).toMatchObject({ role: "seller" });
      expect(JSON.stringify(sellerView)).not.toContain('"results"');
      completedScenarioCount += 1;
    },
    150_000,
  );
});

function readDifficulty(value: string | undefined) {
  if (value === "full" || value === "hard") {
    return value;
  }

  return "baseline" as const;
}

function expectScore(score: number, expected: ExpectedScore) {
  if (expected.exact !== undefined) {
    expect(score).toBe(expected.exact);
  }

  if (expected.minimum !== undefined) {
    expect(score).toBeGreaterThanOrEqual(expected.minimum);
  }

  if (expected.maximum !== undefined) {
    expect(score).toBeLessThanOrEqual(expected.maximum);
  }
}

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function authorizedRead(evaluationId: string, token: string) {
  return new Request(
    `http://localhost/api/evaluations/${evaluationId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

function tokenFromPath(path: string) {
  const token = readCapabilityToken(new URL(path, "http://localhost").hash);

  if (!token) {
    throw new Error("The live test received an invalid capability path.");
  }

  return token;
}
