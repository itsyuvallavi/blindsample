import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getCapabilityPepper,
  hashCapabilityToken,
  issueEvaluationCapabilities,
} from "../access/capabilities";
import { hashCanonicalValue } from "../evaluation-contracts/hash";
import type { EvaluationContract } from "../evaluation-contracts/types";
import type {
  EvaluationQuestion,
  GeneratedEvaluationPlan,
} from "../evaluation-plans/types";
import {
  emptyEvaluationRunDiagnostics,
  type EvaluationRunDiagnostics,
} from "../scoring/run-diagnostics";
import type { EvaluationResult } from "../scoring/types";

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
  questionSetHash: string;
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
  approvedAt: string;
  expiresAt: string;
  id: string;
  plans: GeneratedEvaluationPlan[] | null;
  questions: EvaluationQuestion[];
  status: EvaluationStatus;
  title: string;
};

export type BuyerEvaluationView = SellerEvaluationView & {
  completedAt: string | null;
  errorCode: string | null;
  inferenceDiagnostics: EvaluationRunDiagnostics;
  results: EvaluationResult[] | null;
  sampleColumnCount: number | null;
  sampleRowCount: number | null;
};

export type CompletedEvaluationResult = {
  inferenceDiagnostics: EvaluationRunDiagnostics;
  plans: GeneratedEvaluationPlan[];
  results: EvaluationResult[];
  sampleColumnCount: number;
  sampleRowCount: number;
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
    approved_at: now.toISOString(),
    buyer_token_hash: capabilities.buyer.hash,
    contract_set_hash: input.questionSetHash,
    contracts: input.questions as Json,
    environment,
    expires_at: expiresAt.toISOString(),
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
    .select("id, title, status, contracts, approved_at, expires_at")
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

  const stored = readStoredEvaluation(data.contracts);

  return {
    approvedAt: data.approved_at,
    expiresAt: data.expires_at,
    id: data.id,
    plans: stored.plans,
    questions: stored.questions,
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
      "id, title, status, contracts, results, inference_diagnostics, sample_row_count, sample_column_count, error_code, completed_at, approved_at, expires_at",
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

  const stored = readStoredEvaluation(data.contracts);

  return {
    approvedAt: data.approved_at,
    completedAt: data.completed_at,
    errorCode: data.error_code,
    expiresAt: data.expires_at,
    id: data.id,
    inferenceDiagnostics:
      data.inference_diagnostics as EvaluationRunDiagnostics,
    results: data.results as EvaluationResult[] | null,
    sampleColumnCount: data.sample_column_count,
    sampleRowCount: data.sample_row_count,
    plans: stored.plans,
    questions: stored.questions,
    status: data.status as EvaluationStatus,
    title: data.title,
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
      inference_diagnostics:
        emptyEvaluationRunDiagnostics() as unknown as Json,
      sample_column_count: input.sampleColumnCount,
      sample_row_count: input.sampleRowCount,
      status: "processing",
      updated_at: now.toISOString(),
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
  result: CompletedEvaluationResult,
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
      contract_set_hash: hashCanonicalValue(result.plans),
      contracts: result.plans as unknown as Json,
      error_code: null,
      inference_diagnostics:
        result.inferenceDiagnostics as unknown as Json,
      results: result.results as Json,
      sample_column_count: result.sampleColumnCount,
      sample_row_count: result.sampleRowCount,
      status: "complete",
      updated_at: now.toISOString(),
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
  inferenceDiagnostics: EvaluationRunDiagnostics,
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
      inference_diagnostics:
        inferenceDiagnostics as unknown as Json,
      results: null,
      status: "failed",
      updated_at: now.toISOString(),
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

function readStoredEvaluation(value: Json): {
  plans: GeneratedEvaluationPlan[] | null;
  questions: EvaluationQuestion[];
} {
  if (!Array.isArray(value)) {
    return { plans: null, questions: [] };
  }

  if (value.every(isGeneratedEvaluationPlan)) {
    const plans = value as unknown as GeneratedEvaluationPlan[];

    return {
      plans,
      questions: plans.map((plan) => ({
        id: plan.questionId,
        question: plan.originalQuestion,
      })),
    };
  }

  if (value.every(isEvaluationQuestion)) {
    return {
      plans: null,
      questions: value as unknown as EvaluationQuestion[],
    };
  }

  if (value.every(isLegacyContract)) {
    const contracts = value as unknown as EvaluationContract[];

    return {
      plans: null,
      questions: contracts.map((contract) => ({
        id: contract.questionId,
        question: contract.originalQuestion,
      })),
    };
  }

  return { plans: null, questions: [] };
}

function isEvaluationQuestion(value: Json) {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.question === "string" &&
    !("method" in value)
  );
}

function isGeneratedEvaluationPlan(value: Json) {
  return (
    isRecord(value) &&
    value.planVersion === "2.0.0" &&
    typeof value.questionId === "string" &&
    typeof value.originalQuestion === "string"
  );
}

function isLegacyContract(value: Json) {
  return (
    isRecord(value) &&
    typeof value.questionId === "string" &&
    typeof value.originalQuestion === "string" &&
    (value.method === "deterministic" || value.method === "semantic")
  );
}

function isRecord(value: Json): value is Record<string, Json> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
