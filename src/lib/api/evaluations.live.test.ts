import { afterEach, describe, expect, it } from "vitest";

import { readCapabilityToken } from "../browser/capability";
import { createDefaultSemanticCriterion } from "../evaluation-contracts/default-semantic";
import { getSupabaseServerClient } from "../supabase/client";
import { paidLiveEnabled } from "../testing/paid-live";
import {
  handleCreateEvaluation,
  handleGetEvaluation,
  handlePreviewEvaluationContracts,
  handleSubmitEvaluation,
} from "./evaluations";

const describeLive =
  paidLiveEnabled("END_TO_END_LIVE") ? describe : describe.skip;
const createdIds: string[] = [];
const criteria = [
  {
    columns: ["message"],
    id: "complete",
    kind: "completeness" as const,
    question: "Are the submitted messages complete?",
  },
  createDefaultSemanticCriterion("relevance"),
];

describeLive("live evaluation API flow", () => {
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

  it(
    "publishes one safe result per approved contract",
    async () => {
      const previewResponse =
        await handlePreviewEvaluationContracts(
          jsonRequest("/api/evaluation-contracts", { criteria }),
        );
      expect(previewResponse.status).toBe(200);

      const preview = (await previewResponse.json()) as {
        contractSetHash: string;
        contracts: unknown[];
      };
      expect(preview.contracts).toHaveLength(criteria.length);

      const createResponse = await handleCreateEvaluation(
        jsonRequest("/api/evaluations", {
          approvedContractSetHash: preview.contractSetHash,
          criteria,
          title: "Synthetic end-to-end verification",
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
        new File(
          [
            [
              "message",
              "I was charged twice for my subscription.",
              "I cannot log in to my account.",
              "Please cancel my subscription.",
              "How can I reset my password?",
              "My refund has not arrived.",
            ].join("\n"),
          ],
          "synthetic-support.csv",
          { type: "text/csv" },
        ),
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
          evaluation?: { errorCode?: string | null };
        };

        throw new Error(
          `Live submission returned ${submitResponse.status}; stored code: ${
            failedView.evaluation?.errorCode ?? "unavailable"
          }.`,
        );
      }

      const buyerResponse = await handleGetEvaluation(
        authorizedRead(created.evaluationId, buyerToken),
        created.evaluationId,
      );
      const buyerView = (await buyerResponse.json()) as {
        evaluation: {
          inferenceDiagnostics: {
            requestCount: {
              made: number;
              maximum: number;
            };
            requests: unknown[];
          };
          results: Array<{
            evidence: {
              zeroG: {
                teeVerified: boolean;
              } | null;
            };
            questionId: string;
            status: string;
          }>;
          status: string;
        };
        role: string;
      };

      expect(buyerView.role).toBe("buyer");
      expect(buyerView.evaluation.status).toBe("complete");
      expect(buyerView.evaluation.results).toHaveLength(
        criteria.length,
      );
      expect(
        buyerView.evaluation.inferenceDiagnostics.requestCount,
      ).toEqual({ made: 2, maximum: 2 });
      expect(
        buyerView.evaluation.inferenceDiagnostics.requests,
      ).toHaveLength(2);
      expect(
        buyerView.evaluation.results.map((result) => result.questionId),
      ).toEqual(criteria.map((criterion) => criterion.id));
      const semanticResult = buyerView.evaluation.results.find(
        (result) => result.questionId === "relevance",
      );
      expect(semanticResult?.status).toBe("scored");
      expect(semanticResult?.evidence.zeroG?.teeVerified).toBe(true);

      const sellerResponse = await handleGetEvaluation(
        authorizedRead(created.evaluationId, sellerToken),
        created.evaluationId,
      );
      const sellerView = await sellerResponse.json();
      expect(sellerView).toMatchObject({ role: "seller" });
      expect(JSON.stringify(sellerView)).not.toContain('"results"');
    },
    90_000,
  );
});

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
