import { mkdir, writeFile } from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { readCapabilityToken } from "../browser/capability";
import type { SemanticControlClassification } from "../scoring/types";
import { getSupabaseServerClient } from "../supabase/client";
import { paidLiveEnabled } from "../testing/paid-live";
import {
  SEMANTIC_E2E_EXPECTED_QUESTION_RESULTS,
  SEMANTIC_E2E_MAXIMUM_INFERENCE_REQUESTS,
  SEMANTIC_E2E_SCENARIOS,
  type SemanticE2EScenario,
} from "../testing/semantic-e2e-scenarios";
import {
  handleCreateEvaluation,
  handleGetEvaluation,
  handleSubmitEvaluation,
} from "./evaluations";

const describeLive = paidLiveEnabled("SCENARIO_MATRIX_LIVE")
  ? describe
  : describe.skip;
const createdIds: string[] = [];

type QuestionResult = {
  agreement: string;
  controlCheck: string;
  controlClassifications: SemanticControlClassification[] | null;
  expectedScore: number;
  method: string;
  questionId: string;
  reason: string | null;
  score: number | null;
  status: string;
  teeVerified: boolean | null;
};

type ScenarioResult = {
  costNeuron: string;
  description: string;
  expectedInferenceRequests: number;
  hasOverallScore: boolean;
  id: string;
  inferenceRequests: number;
  questions: QuestionResult[];
  teeVerified: boolean;
};

describeLive("five-scenario multi-question semantic E2E matrix", () => {
  afterAll(async () => {
    if (createdIds.length === 0) {
      return;
    }

    const client = getSupabaseServerClient();
    const { error } = await client
      .from("evaluations")
      .delete()
      .in("id", createdIds);

    if (error) {
      throw new Error("Scenario-matrix cleanup failed.", {
        cause: error,
      });
    }

    const { count, error: verificationError } = await client
      .from("evaluations")
      .select("id", { count: "exact", head: true })
      .in("id", createdIds);

    if (verificationError || count !== 0) {
      throw new Error("Scenario-matrix cleanup could not be verified.", {
        cause: verificationError ?? undefined,
      });
    }
  });

  it(
    "publishes independent question-level scores across five datasets",
    async () => {
      expect(SEMANTIC_E2E_MAXIMUM_INFERENCE_REQUESTS).toBe(16);
      const results: ScenarioResult[] = [];

      for (const scenario of SEMANTIC_E2E_SCENARIOS) {
        results.push(await runScenario(scenario));
      }

      const report = {
        event: "semantic_e2e_scenario_matrix",
        maximumInferenceRequests:
          SEMANTIC_E2E_MAXIMUM_INFERENCE_REQUESTS,
        results,
        totalInferenceRequests: results.reduce(
          (sum, result) => sum + result.inferenceRequests,
          0,
        ),
        totalCostNeuron: results
          .reduce(
            (sum, result) => sum + BigInt(result.costNeuron),
            BigInt(0),
          )
          .toString(),
        totalQuestionResults: results.reduce(
          (sum, result) => sum + result.questions.length,
          0,
        ),
      };

      console.info(JSON.stringify(report));
      await writeSanitizedReport(report);

      expect(results).toHaveLength(SEMANTIC_E2E_SCENARIOS.length);
      expect(
        results.reduce(
          (sum, result) => sum + result.inferenceRequests,
          0,
        ),
      ).toBe(SEMANTIC_E2E_MAXIMUM_INFERENCE_REQUESTS);
      expect(
        results.reduce(
          (sum, result) => sum + result.questions.length,
          0,
        ),
      ).toBe(SEMANTIC_E2E_EXPECTED_QUESTION_RESULTS);

      for (const result of results) {
        expect(result.hasOverallScore).toBe(false);
        expect(result.inferenceRequests).toBe(
          result.expectedInferenceRequests,
        );
        expect(result.questions.length).toBeGreaterThanOrEqual(2);
        expect(result.teeVerified).toBe(true);

        for (const question of result.questions) {
          expect(question).toMatchObject({
            reason: null,
            status: "scored",
          });
          expect(question.score).toBe(question.expectedScore);

          if (question.method === "semantic") {
            expect(question).toMatchObject({
              agreement: "passed",
              controlCheck: "passed",
              teeVerified: true,
            });
            expect(question.controlClassifications).toHaveLength(3);

            for (const control of question.controlClassifications ?? []) {
              expect(control.originalLabel).toBe(
                control.expectedLabel,
              );
              expect(control.repeatedLabel).toBe(
                control.expectedLabel,
              );
            }
          } else {
            expect(question).toMatchObject({
              agreement: "not_applicable",
              controlCheck: "not_applicable",
              controlClassifications: null,
              teeVerified: null,
            });
          }
        }
      }
    },
    240_000,
  );
});

async function runScenario(
  scenario: SemanticE2EScenario,
): Promise<ScenarioResult> {
  const createResponse = await handleCreateEvaluation(
    jsonRequest("/api/evaluations", {
      questions: scenario.questions,
      title: `Semantic matrix: ${scenario.id}`,
    }),
  );

  if (createResponse.status !== 201) {
    throw new Error(
      `Scenario ${scenario.id} creation failed with HTTP ${createResponse.status}.`,
    );
  }

  const created = (await createResponse.json()) as {
    buyerPath: string;
    evaluationId: string;
    sellerPath: string;
  };
  createdIds.push(created.evaluationId);

  const buyerToken = tokenFromPath(created.buyerPath);
  const sellerToken = tokenFromPath(created.sellerPath);
  const form = new FormData();
  form.set(
    "sample",
    new File([scenarioCsv(scenario)], `${scenario.id}.csv`, {
      type: "text/csv",
    }),
  );
  const submitResponse = await handleSubmitEvaluation(
    new Request(
      `http://localhost/api/evaluations/${created.evaluationId}/submit`,
      {
        body: form,
        headers: { Authorization: `Bearer ${sellerToken}` },
        method: "POST",
      },
    ),
    created.evaluationId,
  );
  const buyerResponse = await handleGetEvaluation(
    authorizedRead(created.evaluationId, buyerToken),
    created.evaluationId,
  );
  const buyerView = (await buyerResponse.json()) as {
    evaluation?: {
      errorCode?: string | null;
      inferenceDiagnostics?: {
        requestCount: { made: number; maximum: number };
        requests: Array<{
          billing: { totalCostNeuron: string | null };
          teeVerified: boolean | null;
        }>;
      };
      results?: Array<{
        evidence: {
          agreement: { status: string };
          controlCheck: string;
          controlClassifications?: SemanticControlClassification[];
          method: string;
          zeroG: { teeVerified: boolean } | null;
        };
        questionId: string;
        reason?: string;
        score: number | null;
        status: string;
      }>;
      status?: string;
    };
    role?: string;
  };

  if (
    submitResponse.status !== 200 ||
    buyerResponse.status !== 200 ||
    buyerView.evaluation?.status !== "complete"
  ) {
    throw new Error(
      `Scenario ${scenario.id} failed: submit HTTP ${submitResponse.status}, read HTTP ${buyerResponse.status}, stored code ${
        buyerView.evaluation?.errorCode ?? "unavailable"
      }.`,
    );
  }

  const diagnostics = buyerView.evaluation.inferenceDiagnostics;
  const storedResults = buyerView.evaluation.results;

  if (!diagnostics || !storedResults) {
    throw new Error(`Scenario ${scenario.id} returned incomplete results.`);
  }

  const expectedQuestionIds = Object.keys(scenario.expectedScores);
  const returnedQuestionIds = storedResults.map(
    ({ questionId }) => questionId,
  );

  if (
    expectedQuestionIds.length !== returnedQuestionIds.length ||
    expectedQuestionIds.some(
      (questionId) => !returnedQuestionIds.includes(questionId),
    )
  ) {
    throw new Error(
      `Scenario ${scenario.id} returned unexpected question results.`,
    );
  }

  const questions = storedResults.map((result): QuestionResult => {
    const expectedScore = scenario.expectedScores[result.questionId];

    if (expectedScore === undefined) {
      throw new Error(
        `Scenario ${scenario.id} returned unknown question ${result.questionId}.`,
      );
    }

    return {
      agreement: result.evidence.agreement.status,
      controlCheck: result.evidence.controlCheck,
      controlClassifications:
        result.evidence.controlClassifications ?? null,
      expectedScore,
      method: result.evidence.method,
      questionId: result.questionId,
      reason: result.reason ?? null,
      score: result.score,
      status: result.status,
      teeVerified:
        result.evidence.method === "semantic"
          ? result.evidence.zeroG?.teeVerified === true
          : null,
    };
  });
  const expectedInferenceRequests =
    scenario.questions.filter(
      (question) => question.id !== "completeness",
    ).length * 2;

  return {
    costNeuron: diagnostics.requests
      .reduce(
        (sum, request) =>
          sum + BigInt(request.billing.totalCostNeuron ?? "0"),
        BigInt(0),
      )
      .toString(),
    description: scenario.description,
    expectedInferenceRequests,
    hasOverallScore: Object.hasOwn(
      buyerView.evaluation,
      "overallScore",
    ),
    id: scenario.id,
    inferenceRequests: diagnostics.requestCount.made,
    questions,
    teeVerified:
      questions
        .filter(({ method }) => method === "semantic")
        .every(({ teeVerified }) => teeVerified === true) &&
      diagnostics.requests.every(
        (request) => request.teeVerified === true,
      ),
  };
}

function scenarioCsv(scenario: SemanticE2EScenario) {
  return [
    "message",
    ...scenario.rows.map(
      (row) => `"${row.replaceAll('"', '""')}"`,
    ),
  ].join("\n");
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
  const token = readCapabilityToken(
    new URL(path, "http://localhost").hash,
  );

  if (!token) {
    throw new Error("The scenario matrix received an invalid capability path.");
  }

  return token;
}

async function writeSanitizedReport(report: unknown) {
  const configuredPath =
    process.env.SEMANTIC_E2E_REPORT_PATH?.trim();

  if (!configuredPath) {
    return;
  }

  const reportPath = resolve(configuredPath);
  const allowedDirectory = resolve("tmp");
  const relativePath = relative(allowedDirectory, reportPath);

  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(
      "SEMANTIC_E2E_REPORT_PATH must point to a file inside tmp/.",
    );
  }

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    `${JSON.stringify(report, null, 2)}\n`,
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );
}
