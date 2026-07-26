import { afterAll, describe, expect, it } from "vitest";

import { readCapabilityToken } from "../browser/capability";
import { getSupabaseServerClient } from "../supabase/client";
import { paidLiveEnabled } from "../testing/paid-live";
import {
  SEMANTIC_E2E_CRITERIA,
  SEMANTIC_E2E_MAXIMUM_INFERENCE_REQUESTS,
  SEMANTIC_E2E_SCENARIOS,
  type SemanticE2EScenario,
} from "../testing/semantic-e2e-scenarios";
import {
  handleCreateEvaluation,
  handleGetEvaluation,
  handlePreviewEvaluationContracts,
  handleSubmitEvaluation,
} from "./evaluations";

const describeLive = paidLiveEnabled("SCENARIO_MATRIX_LIVE")
  ? describe
  : describe.skip;
const createdIds: string[] = [];

type ScenarioResult = {
  agreement: string | null;
  completenessScore: number | null;
  controlCheck: string | null;
  controlClassifications: Array<{
    controlId: string;
    expectedLabel: string;
    originalLabel: string;
    repeatedLabel: string;
  }> | null;
  costNeuron: string;
  description: string;
  expectedSemanticScore: number;
  id: string;
  inferenceRequests: number;
  semanticReason: string | null;
  semanticScore: number | null;
  semanticStatus: string;
  teeVerified: boolean;
};

describeLive("ten-scenario semantic E2E matrix", () => {
  afterAll(async () => {
    if (createdIds.length === 0) {
      return;
    }

    const { error } = await getSupabaseServerClient()
      .from("evaluations")
      .delete()
      .in("id", createdIds);

    if (error) {
      throw new Error("Scenario-matrix cleanup failed.", {
        cause: error,
      });
    }
  });

  it(
    "publishes stable question-level scores across the matrix",
    async () => {
      expect(SEMANTIC_E2E_MAXIMUM_INFERENCE_REQUESTS).toBe(20);
      const results: ScenarioResult[] = [];

      for (const scenario of SEMANTIC_E2E_SCENARIOS) {
        results.push(await runScenario(scenario));
      }

      console.info(
        JSON.stringify({
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
        }),
      );

      expect(results).toHaveLength(SEMANTIC_E2E_SCENARIOS.length);
      expect(
        results.reduce(
          (sum, result) => sum + result.inferenceRequests,
          0,
        ),
      ).toBeLessThanOrEqual(SEMANTIC_E2E_MAXIMUM_INFERENCE_REQUESTS);

      for (const result of results) {
        expect(result).toMatchObject({
          agreement: "passed",
          completenessScore: 100,
          controlCheck: "passed",
          inferenceRequests: 2,
          semanticReason: null,
          semanticStatus: "scored",
          teeVerified: true,
        });
        expect(result.semanticScore).toBe(result.expectedSemanticScore);
      }

      const balanced = results.find(
        ({ id }) => id === "balanced_mix",
      );
      const reversed = results.find(
        ({ id }) => id === "balanced_reversed",
      );
      expect(reversed?.semanticScore).toBe(balanced?.semanticScore);
    },
    240_000,
  );
});

async function runScenario(
  scenario: SemanticE2EScenario,
): Promise<ScenarioResult> {
  const previewResponse = await handlePreviewEvaluationContracts(
    jsonRequest("/api/evaluation-contracts", {
      criteria: SEMANTIC_E2E_CRITERIA,
    }),
  );

  if (previewResponse.status !== 200) {
    throw new Error(
      `Scenario ${scenario.id} contract preview failed with HTTP ${previewResponse.status}.`,
    );
  }

  const preview = (await previewResponse.json()) as {
    contractSetHash: string;
  };
  const createResponse = await handleCreateEvaluation(
    jsonRequest("/api/evaluations", {
      approvedContractSetHash: preview.contractSetHash,
      criteria: SEMANTIC_E2E_CRITERIA,
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
          controlClassifications?: Array<{
            controlId: string;
            expectedLabel: string;
            originalLabel: string;
            repeatedLabel: string;
          }>;
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

  const completeness = buyerView.evaluation.results?.find(
    ({ questionId }) => questionId === "completeness",
  );
  const semantic = buyerView.evaluation.results?.find(
    ({ questionId }) => questionId === "action_required",
  );
  const diagnostics = buyerView.evaluation.inferenceDiagnostics;

  if (!completeness || !semantic || !diagnostics) {
    throw new Error(`Scenario ${scenario.id} returned incomplete results.`);
  }

  return {
    agreement: semantic.evidence.agreement.status,
    completenessScore: completeness.score,
    controlCheck: semantic.evidence.controlCheck,
    controlClassifications:
      semantic.evidence.controlClassifications ?? null,
    costNeuron: diagnostics.requests
      .reduce(
        (sum, request) =>
          sum + BigInt(request.billing.totalCostNeuron ?? "0"),
        BigInt(0),
      )
      .toString(),
    description: scenario.description,
    expectedSemanticScore: scenario.expectedSemanticScore,
    id: scenario.id,
    inferenceRequests: diagnostics.requestCount.made,
    semanticReason: semantic.reason ?? null,
    semanticScore: semantic.score,
    semanticStatus: semantic.status,
    teeVerified:
      semantic.evidence.zeroG?.teeVerified === true &&
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
