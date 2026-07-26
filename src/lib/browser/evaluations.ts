import type { EvaluationQuestion } from "../evaluation-plans/types";
import type { EvaluationRunDiagnostics } from "../scoring/run-diagnostics";
import type { BuyerQuestionResult } from "../supabase/evaluations";

export type EvaluationStatus =
  | "waiting_for_seller"
  | "processing"
  | "complete"
  | "failed";

export type SellerEvaluation = {
  approvedAt: string;
  completion: {
    privateInferenceUsed: boolean;
    questionCount: number;
    rowCount: number;
    scoredCount: number;
    unableCount: number;
  } | null;
  expiresAt: string;
  failure: {
    code: string | null;
    requestMade: boolean;
  };
  id: string;
  questions: EvaluationQuestion[];
  status: EvaluationStatus;
  title: string;
};

export type BuyerEvaluation = SellerEvaluation & {
  completedAt: string | null;
  errorCode: string | null;
  inferenceDiagnostics: EvaluationRunDiagnostics;
  results: BuyerQuestionResult[] | null;
  verifiedComplete: boolean;
};

export type EvaluationResponse =
  | { evaluation: BuyerEvaluation; role: "buyer" }
  | { evaluation: SellerEvaluation; role: "seller" };

export type CreatedEvaluationResponse = {
  buyerPath: string;
  evaluationId: string;
  expiresAt: string;
  sellerPath: string;
  status: "waiting_for_seller";
};

export class BrowserApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BrowserApiError";
  }
}

export async function readEvaluation(
  evaluationId: string,
  token: string,
) {
  return requestJson<EvaluationResponse>(
    `/api/evaluations/${encodeURIComponent(evaluationId)}`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export async function createEvaluation(input: {
  questions: EvaluationQuestion[];
  title: string;
}) {
  return requestJson<CreatedEvaluationResponse>("/api/evaluations", {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

export async function submitSample(
  evaluationId: string,
  token: string,
  file: File,
) {
  const body = new FormData();
  body.set("sample", file);

  return requestJson<{ status: "complete" }>(
    `/api/evaluations/${encodeURIComponent(evaluationId)}/submit`,
    {
      body,
      headers: { Authorization: `Bearer ${token}` },
      method: "POST",
    },
  );
}

async function requestJson<T>(input: string, init: RequestInit) {
  let response: Response;

  try {
    response = await fetch(input, init);
  } catch {
    throw new BrowserApiError(
      "BlindSample could not reach the server. Try again.",
      "network_error",
      0,
    );
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new BrowserApiError(
      "BlindSample received an invalid server response.",
      "invalid_response",
      response.status,
    );
  }

  if (!response.ok) {
    const error = readError(body);
    throw new BrowserApiError(
      error.message,
      error.code,
      response.status,
    );
  }

  return body as T;
}

function readError(body: unknown): { code: string; message: string } {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "code" in body.error &&
    "message" in body.error &&
    typeof body.error.code === "string" &&
    typeof body.error.message === "string"
  ) {
    return {
      code: body.error.code,
      message: body.error.message,
    };
  }

  return {
    code: "unknown_error",
    message: "BlindSample could not complete the request.",
  };
}
