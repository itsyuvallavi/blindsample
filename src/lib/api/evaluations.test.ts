import { describe, expect, it, vi } from "vitest";

import { CsvSampleError } from "../csv/parse-sample";
import { compileEvaluationContracts } from "../evaluation-contracts/compile";
import { hashEvaluationContracts } from "../evaluation-contracts/hash";
import { SampleSubmissionError } from "../evaluations/submit";
import {
  handleCreateEvaluation,
  handleGetEvaluation,
  handlePreviewEvaluationContracts,
  handleSubmitEvaluation,
} from "./evaluations";

const EVALUATION_ID = "5f27e1d9-74ac-4f43-93af-f530c2bb08d0";
const BUYER_TOKEN = "a".repeat(43);
const SELLER_TOKEN = "b".repeat(43);
const CRITERIA = [
  {
    columns: ["description"],
    controls: {
      intermediate: "A general product question.",
      negative: "A weather report unrelated to support.",
      positive: "A customer asks an agent to restore account access.",
    },
    id: "q1",
    kind: "semantic_relevance",
    question: "Is this useful for support classification?",
    target: "Customer requests requiring a support agent response.",
  },
] as const;
const CONTRACTS = compileEvaluationContracts(CRITERIA);
const CONTRACT_SET_HASH = hashEvaluationContracts(CONTRACTS);

describe("evaluation API boundary", () => {
  it("previews contracts without activating a seller link", async () => {
    const response = await handlePreviewEvaluationContracts(
      jsonRequest("https://example.test/api/evaluation-contracts", {
        criteria: CRITERIA,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      contracts: CONTRACTS,
      contractSetHash: CONTRACT_SET_HASH,
    });
    expect(body).not.toHaveProperty("sellerPath");
    expect(body).not.toHaveProperty("buyerPath");
  });

  it("creates separate fragment-only paths after exact approval", async () => {
    const create = vi.fn().mockResolvedValue({
      buyerToken: BUYER_TOKEN,
      expiresAt: "2026-07-27T01:00:00.000Z",
      id: EVALUATION_ID,
      sellerToken: SELLER_TOKEN,
      status: "waiting_for_seller",
    });
    const request = jsonRequest("https://example.test/api/evaluations", {
      approvedContractSetHash: CONTRACT_SET_HASH,
      criteria: CRITERIA,
      title: "Forecast sample",
    });

    const response = await handleCreateEvaluation(request, { create });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      buyerPath: `/results/${EVALUATION_ID}#token=${BUYER_TOKEN}`,
      evaluationId: EVALUATION_ID,
      expiresAt: "2026-07-27T01:00:00.000Z",
      sellerPath: `/submit/${EVALUATION_ID}#token=${SELLER_TOKEN}`,
      status: "waiting_for_seller",
    });
    expect(body).not.toHaveProperty("buyerToken");
    expect(body).not.toHaveProperty("sellerToken");
    expect(create).toHaveBeenCalledWith({
      contracts: CONTRACTS,
      contractSetHash: CONTRACT_SET_HASH,
      title: "Forecast sample",
    });
  });

  it("rejects extra or changed creation fields before persistence", async () => {
    const create = vi.fn();
    const request = jsonRequest("https://example.test/api/evaluations", {
      approvedContractSetHash: CONTRACT_SET_HASH,
      criteria: CRITERIA,
      title: "Forecast sample",
      userId: "not-allowed",
    });

    const response = await handleCreateEvaluation(request, { create });

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();

    const changedResponse = await handleCreateEvaluation(
      jsonRequest("https://example.test/api/evaluations", {
        approvedContractSetHash: CONTRACT_SET_HASH,
        criteria: [
          {
            ...CRITERIA[0],
            target: "Changed after review and not approved.",
          },
        ],
        title: "Forecast sample",
      }),
      { create },
    );

    expect(changedResponse.status).toBe(400);
    expect(await changedResponse.json()).toMatchObject({
      error: { code: "approval_mismatch" },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared creation body before parsing", async () => {
    const create = vi.fn();
    const request = jsonRequest("https://example.test/api/evaluations", {
      approvedContractSetHash: CONTRACT_SET_HASH,
      criteria: CRITERIA,
      title: "Forecast sample",
    });
    request.headers.set("Content-Length", "20000");

    const response = await handleCreateEvaluation(request, { create });

    expect(response.status).toBe(413);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns only the buyer view for a buyer capability", async () => {
    const getBuyer = vi.fn().mockResolvedValue({
      approvedAt: "2026-07-26T00:00:00.000Z",
      completedAt: null,
      contracts: CONTRACTS,
      errorCode: null,
      expiresAt: "2026-07-27T01:00:00.000Z",
      id: EVALUATION_ID,
      results: null,
      sampleColumnCount: null,
      sampleRowCount: null,
      status: "waiting_for_seller",
      title: "Forecast sample",
    });
    const getSeller = vi.fn();

    const response = await handleGetEvaluation(
      authorizedRequest(
        `https://example.test/api/evaluations/${EVALUATION_ID}`,
        BUYER_TOKEN,
      ),
      EVALUATION_ID,
      { getBuyer, getSeller },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.role).toBe("buyer");
    expect(body.evaluation).toHaveProperty("results", null);
    expect(getSeller).not.toHaveBeenCalled();
  });

  it("falls back to the restricted seller view", async () => {
    const getBuyer = vi.fn().mockResolvedValue(null);
    const getSeller = vi.fn().mockResolvedValue({
      approvedAt: "2026-07-26T00:00:00.000Z",
      contracts: CONTRACTS,
      expiresAt: "2026-07-27T01:00:00.000Z",
      id: EVALUATION_ID,
      status: "waiting_for_seller",
      title: "Forecast sample",
    });

    const response = await handleGetEvaluation(
      authorizedRequest(
        `https://example.test/api/evaluations/${EVALUATION_ID}`,
        SELLER_TOKEN,
      ),
      EVALUATION_ID,
      { getBuyer, getSeller },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.role).toBe("seller");
    expect(body.evaluation).not.toHaveProperty("results");
  });

  it("rejects malformed capabilities without a database read", async () => {
    const getBuyer = vi.fn();
    const getSeller = vi.fn();

    const response = await handleGetEvaluation(
      authorizedRequest(
        `https://example.test/api/evaluations/${EVALUATION_ID}`,
        "too-short",
      ),
      EVALUATION_ID,
      { getBuyer, getSeller },
    );

    expect(response.status).toBe(404);
    expect(getBuyer).not.toHaveBeenCalled();
    expect(getSeller).not.toHaveBeenCalled();
  });

  it("passes one in-memory CSV file to seller submission", async () => {
    const submit = vi.fn().mockResolvedValue({ status: "complete" });
    const formData = new FormData();
    formData.set(
      "sample",
      new File(["name,value\none,1\n"], "sample.csv", {
        type: "text/csv",
      }),
    );
    const request = new Request(
      `https://example.test/api/evaluations/${EVALUATION_ID}/submit`,
      {
        body: formData,
        headers: { Authorization: `Bearer ${SELLER_TOKEN}` },
        method: "POST",
      },
    );

    const response = await handleSubmitEvaluation(
      request,
      EVALUATION_ID,
      { submit },
    );

    expect(response.status).toBe(200);
    expect(submit).toHaveBeenCalledOnce();
    expect(submit.mock.calls[0][0]).toMatchObject({
      evaluationId: EVALUATION_ID,
      sellerToken: SELLER_TOKEN,
    });
    expect(
      new TextDecoder().decode(submit.mock.calls[0][0].bytes),
    ).toBe("name,value\none,1\n");
  });

  it("maps safe CSV and scoring failures without exposing causes", async () => {
    const csvResponse = await submitWithFailure(
      new CsvSampleError("The CSV sample is malformed.", "invalid_csv"),
    );
    const scoringResponse = await submitWithFailure(
      new SampleSubmissionError(
        "provider details must stay internal",
        "scoring_failed",
      ),
    );

    expect(csvResponse.status).toBe(400);
    expect(await csvResponse.json()).toEqual({
      error: {
        code: "invalid_csv",
        message: "The CSV sample is malformed.",
      },
    });
    expect(scoringResponse.status).toBe(502);
    expect(JSON.stringify(await scoringResponse.json())).not.toContain(
      "provider details",
    );
  });
});

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function authorizedRequest(url: string, token: string) {
  return new Request(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function submitWithFailure(error: Error) {
  const formData = new FormData();
  formData.set("sample", new File(["a\nb\n"], "sample.csv"));

  return handleSubmitEvaluation(
    new Request(
      `https://example.test/api/evaluations/${EVALUATION_ID}/submit`,
      {
        body: formData,
        headers: { Authorization: `Bearer ${SELLER_TOKEN}` },
        method: "POST",
      },
    ),
    EVALUATION_ID,
    {
      submit: vi.fn().mockRejectedValue(error),
    },
  );
}
