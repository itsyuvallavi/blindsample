import { describe, expect, it, vi } from "vitest";

import { hashEvaluationQuestions } from "../evaluation-contracts/hash";
import { SampleSubmissionError } from "../evaluations/submit";
import { SampleError } from "../samples/types";
import {
  handleCreateEvaluation,
  handleGetEvaluation,
  handlePreviewEvaluationContracts,
  handleSubmitEvaluation,
} from "./evaluations";

const EVALUATION_ID = "5f27e1d9-74ac-4f43-93af-f530c2bb08d0";
const BUYER_TOKEN = "a".repeat(43);
const SELLER_TOKEN = "b".repeat(43);
const QUESTIONS = [
  {
    id: "q1",
    question: "Is this useful for support classification?",
  },
] as const;
const QUESTION_SET_HASH = hashEvaluationQuestions([...QUESTIONS]);

describe("evaluation API boundary", () => {
  it("retires buyer-authored contract previews", async () => {
    const response = await handlePreviewEvaluationContracts(
      jsonRequest("https://example.test/api/evaluation-contracts", {
        criteria: [],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toMatchObject({
      error: { code: "question_only_workflow" },
    });
    expect(body).not.toHaveProperty("sellerPath");
    expect(body).not.toHaveProperty("buyerPath");
  });

  it("creates separate fragment-only paths from plain-text questions", async () => {
    const create = vi.fn().mockResolvedValue({
      buyerToken: BUYER_TOKEN,
      expiresAt: "2026-07-27T01:00:00.000Z",
      id: EVALUATION_ID,
      sellerToken: SELLER_TOKEN,
      status: "waiting_for_seller",
    });
    const request = jsonRequest("https://example.test/api/evaluations", {
      questions: QUESTIONS,
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
      questions: QUESTIONS,
      questionSetHash: QUESTION_SET_HASH,
      title: "Forecast sample",
    });
  });

  it("rejects hidden plans or extra creation fields before persistence", async () => {
    const create = vi.fn();
    const request = jsonRequest("https://example.test/api/evaluations", {
      questions: QUESTIONS,
      title: "Forecast sample",
      userId: "not-allowed",
    });

    const response = await handleCreateEvaluation(request, { create });

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();

    const changedResponse = await handleCreateEvaluation(
      jsonRequest("https://example.test/api/evaluations", {
        questions: [
          {
            ...QUESTIONS[0],
            columns: ["message"],
            target: "Buyer-authored technical target.",
          },
        ],
        title: "Forecast sample",
      }),
      { create },
    );

    expect(changedResponse.status).toBe(400);
    expect(await changedResponse.json()).toMatchObject({
      error: { code: "invalid_evaluation" },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared creation body before parsing", async () => {
    const create = vi.fn();
    const request = jsonRequest("https://example.test/api/evaluations", {
      questions: QUESTIONS,
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
      completion: null,
      completedAt: null,
      errorCode: null,
      expiresAt: "2026-07-27T01:00:00.000Z",
      failure: {
        code: null,
        requestMade: false,
      },
      id: EVALUATION_ID,
      questions: QUESTIONS,
      results: null,
      status: "waiting_for_seller",
      title: "Forecast sample",
      verifiedComplete: false,
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
    expect(body.evaluation).not.toHaveProperty("sampleRowCount");
    expect(body.evaluation).not.toHaveProperty("sampleColumnCount");
    expect(getSeller).not.toHaveBeenCalled();
  });

  it("falls back to the restricted seller view", async () => {
    const getBuyer = vi.fn().mockResolvedValue(null);
    const getSeller = vi.fn().mockResolvedValue({
      approvedAt: "2026-07-26T00:00:00.000Z",
      completion: null,
      expiresAt: "2026-07-27T01:00:00.000Z",
      failure: {
        code: null,
        requestMade: false,
      },
      id: EVALUATION_ID,
      questions: QUESTIONS,
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
      fileName: "sample.csv",
      sellerToken: SELLER_TOKEN,
    });
    expect(
      new TextDecoder().decode(submit.mock.calls[0][0].bytes),
    ).toBe("name,value\none,1\n");
  });

  it("maps safe CSV and scoring failures without exposing causes", async () => {
    const csvResponse = await submitWithFailure(
      new SampleError("The CSV sample is malformed.", "invalid_csv"),
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
