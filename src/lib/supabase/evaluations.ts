import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getCapabilityPepper,
  hashCapabilityToken,
  issueEvaluationCapabilities,
} from "@/lib/access/capabilities";

import { getSupabaseServerClient } from "./client";
import type {
  Database,
  EvaluationInsert,
  Json,
} from "./database.types";
import {
  getEvaluationEnvironment,
  type EvaluationEnvironment,
} from "./environment";

const DEFAULT_LIFETIME_MS = 24 * 60 * 60 * 1_000;

export type EvaluationQuestion = {
  id: string;
  text: string;
};

export type EvaluationScore = {
  questionId: string;
  score: number;
};

export type EvaluationStatus =
  | "waiting_for_seller"
  | "processing"
  | "complete"
  | "failed";

type RepositoryOptions = {
  client?: SupabaseClient<Database>;
  environment?: EvaluationEnvironment;
  now?: Date;
  pepper?: string;
};

export type CreateEvaluationInput = {
  expiresAt?: Date;
  questions: EvaluationQuestion[];
  title: string;
};

export type CreatedEvaluation = {
  buyerToken: string;
  expiresAt: string;
  id: string;
  sellerToken: string;
  status: "waiting_for_seller";
};

export type SellerEvaluationView = {
  expiresAt: string;
  id: string;
  questions: EvaluationQuestion[];
  status: EvaluationStatus;
  title: string;
};

export type BuyerEvaluationView = SellerEvaluationView & {
  completedAt: string | null;
  errorCode: string | null;
  sampleColumnCount: number | null;
  sampleRowCount: number | null;
  scores: EvaluationScore[] | null;
  trace: {
    model: string;
    provider: string;
    requestId: string;
    teeVerified: true;
  } | null;
};

export type VerifiedEvaluationResult = {
  sampleColumnCount: number;
  sampleRowCount: number;
  scores: EvaluationScore[];
  trace: {
    model: string;
    provider: string;
    requestId: string;
    teeVerified: true;
  };
};

export class EvaluationRepositoryError extends Error {
  constructor(
    message: string,
    readonly code: "conflict" | "database_error" | "not_found",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EvaluationRepositoryError";
  }
}

export async function createEvaluation(
  input: CreateEvaluationInput,
  options: RepositoryOptions = {},
): Promise<CreatedEvaluation> {
  const client = options.client ?? getSupabaseServerClient();
  const environment =
    options.environment ?? getEvaluationEnvironment();
  const now = options.now ?? new Date();
  const pepper = options.pepper ?? getCapabilityPepper();
  const capabilities = issueEvaluationCapabilities(pepper);
  const expiresAt =
    input.expiresAt ??
    new Date(now.getTime() + DEFAULT_LIFETIME_MS);

  const row: EvaluationInsert = {
    buyer_token_hash: capabilities.buyer.hash,
    environment,
    expires_at: expiresAt.toISOString(),
    questions: input.questions as Json,
    seller_token_hash: capabilities.seller.hash,
    title: input.title,
    updated_at: now.toISOString(),
  };

  const { data, error } = await client
    .from("evaluations")
    .insert(row)
    .select("id, expires_at, status")
    .single();

  if (error || !data) {
    throw databaseError("Unable to create the evaluation.", error);
  }

  return {
    buyerToken: capabilities.buyer.token,
    expiresAt: data.expires_at,
    id: data.id,
    sellerToken: capabilities.seller.token,
    status: "waiting_for_seller",
  };
}

export async function getSellerEvaluation(
  id: string,
  token: string,
  options: RepositoryOptions = {},
): Promise<SellerEvaluationView | null> {
  const client = options.client ?? getSupabaseServerClient();
  const environment =
    options.environment ?? getEvaluationEnvironment();
  const now = options.now ?? new Date();
  const pepper = options.pepper ?? getCapabilityPepper();
  const tokenHash = hashCapabilityToken(token, pepper);

  const { data, error } = await client
    .from("evaluations")
    .select("id, title, status, questions, expires_at")
    .eq("id", id)
    .eq("environment", environment)
    .eq("seller_token_hash", tokenHash)
    .gt("expires_at", now.toISOString())
    .maybeSingle();

  if (error) {
    throw databaseError("Unable to read the evaluation.", error);
  }

  if (!data) {
    return null;
  }

  return {
    expiresAt: data.expires_at,
    id: data.id,
    questions: data.questions as EvaluationQuestion[],
    status: data.status as EvaluationStatus,
    title: data.title,
  };
}

export async function getBuyerEvaluation(
  id: string,
  token: string,
  options: RepositoryOptions = {},
): Promise<BuyerEvaluationView | null> {
  const client = options.client ?? getSupabaseServerClient();
  const environment =
    options.environment ?? getEvaluationEnvironment();
  const now = options.now ?? new Date();
  const pepper = options.pepper ?? getCapabilityPepper();
  const tokenHash = hashCapabilityToken(token, pepper);

  const { data, error } = await client
    .from("evaluations")
    .select(
      "id, title, status, questions, scores, sample_row_count, sample_column_count, zero_g_model, zero_g_provider, zero_g_request_id, tee_verified, error_code, completed_at, expires_at",
    )
    .eq("id", id)
    .eq("environment", environment)
    .eq("buyer_token_hash", tokenHash)
    .gt("expires_at", now.toISOString())
    .maybeSingle();

  if (error) {
    throw databaseError("Unable to read the evaluation.", error);
  }

  if (!data) {
    return null;
  }

  const hasVerifiedTrace =
    data.tee_verified === true &&
    typeof data.zero_g_model === "string" &&
    typeof data.zero_g_provider === "string" &&
    typeof data.zero_g_request_id === "string";

  return {
    completedAt: data.completed_at,
    errorCode: data.error_code,
    expiresAt: data.expires_at,
    id: data.id,
    questions: data.questions as EvaluationQuestion[],
    sampleColumnCount: data.sample_column_count,
    sampleRowCount: data.sample_row_count,
    scores: data.scores as EvaluationScore[] | null,
    status: data.status as EvaluationStatus,
    title: data.title,
    trace: hasVerifiedTrace
      ? {
          model: data.zero_g_model as string,
          provider: data.zero_g_provider as string,
          requestId: data.zero_g_request_id as string,
          teeVerified: true,
        }
      : null,
  };
}

export async function beginSellerSubmission(
  input: {
    id: string;
    sampleColumnCount: number;
    sampleRowCount: number;
    token: string;
  },
  options: RepositoryOptions = {},
) {
  const client = options.client ?? getSupabaseServerClient();
  const environment =
    options.environment ?? getEvaluationEnvironment();
  const now = options.now ?? new Date();
  const pepper = options.pepper ?? getCapabilityPepper();
  const tokenHash = hashCapabilityToken(input.token, pepper);

  const { data, error } = await client
    .from("evaluations")
    .update({
      error_code: null,
      sample_column_count: input.sampleColumnCount,
      sample_row_count: input.sampleRowCount,
      status: "processing",
      updated_at: now.toISOString(),
      zero_g_model: null,
      zero_g_provider: null,
      zero_g_request_id: null,
    })
    .eq("id", input.id)
    .eq("environment", environment)
    .eq("seller_token_hash", tokenHash)
    .gt("expires_at", now.toISOString())
    .in("status", ["waiting_for_seller", "failed"])
    .select("id")
    .maybeSingle();

  if (error) {
    throw databaseError("Unable to begin the evaluation.", error);
  }

  return data !== null;
}

export async function completeEvaluation(
  id: string,
  result: VerifiedEvaluationResult,
  options: RepositoryOptions = {},
) {
  const client = options.client ?? getSupabaseServerClient();
  const environment =
    options.environment ?? getEvaluationEnvironment();
  const now = options.now ?? new Date();

  const { data, error } = await client
    .from("evaluations")
    .update({
      completed_at: now.toISOString(),
      error_code: null,
      sample_column_count: result.sampleColumnCount,
      sample_row_count: result.sampleRowCount,
      scores: result.scores as Json,
      status: "complete",
      tee_verified: true,
      updated_at: now.toISOString(),
      zero_g_model: result.trace.model,
      zero_g_provider: result.trace.provider,
      zero_g_request_id: result.trace.requestId,
    })
    .eq("id", id)
    .eq("environment", environment)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();

  if (error) {
    throw databaseError("Unable to complete the evaluation.", error);
  }

  if (!data) {
    throw new EvaluationRepositoryError(
      "The evaluation is no longer processing.",
      "conflict",
    );
  }
}

export async function failEvaluation(
  id: string,
  errorCode: string,
  options: RepositoryOptions = {},
) {
  const client = options.client ?? getSupabaseServerClient();
  const environment =
    options.environment ?? getEvaluationEnvironment();
  const now = options.now ?? new Date();

  const { data, error } = await client
    .from("evaluations")
    .update({
      completed_at: null,
      error_code: errorCode,
      scores: null,
      status: "failed",
      tee_verified: false,
      updated_at: now.toISOString(),
      zero_g_model: null,
      zero_g_provider: null,
      zero_g_request_id: null,
    })
    .eq("id", id)
    .eq("environment", environment)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();

  if (error) {
    throw databaseError("Unable to record the evaluation failure.", error);
  }

  if (!data) {
    throw new EvaluationRepositoryError(
      "The evaluation is no longer processing.",
      "conflict",
    );
  }
}

function databaseError(message: string, cause: unknown) {
  return new EvaluationRepositoryError(message, "database_error", {
    cause,
  });
}
