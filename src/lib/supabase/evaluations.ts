import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getCapabilityPepper,
  hashCapabilityToken,
  issueEvaluationCapabilities,
} from "../access/capabilities";
import type { EvaluationQuestion } from "../evaluation-plans/types";
import {
  emptyEvaluationRunDiagnostics,
  type EvaluationRunDiagnostics,
} from "../scoring/run-diagnostics";
import {
  isAtomicVerifiedResultSet,
  type EvaluationResult,
} from "../scoring/types";

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

export type BuyerQuestionResult = {
  confidence: number;
  evaluatedBy: "0g";
  explanation: string;
  questionId: string;
  score: number | null;
  status: "scored" | "unable";
  teeVerified: true;
};

export type BuyerEvaluationView = SellerEvaluationView & {
  completedAt: string | null;
  errorCode: string | null;
  inferenceDiagnostics: EvaluationRunDiagnostics;
  results: BuyerQuestionResult[] | null;
  verifiedComplete: boolean;
};

export type CompletedEvaluationResult = {
  inferenceDiagnostics: EvaluationRunDiagnostics;
  questionIds: string[];
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
    .select(
      "id, title, status, contracts, approved_at, expires_at, error_code, inference_diagnostics, results, sample_row_count",
    )
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

  const questions = readStoredQuestions(data.contracts);
  const storedResults = data.results as EvaluationResult[] | null;
  const completion =
    data.status === "complete" &&
    storedResults &&
    data.sample_row_count !== null
      ? {
          privateInferenceUsed:
            readRequestCount(data.inference_diagnostics) === 1,
          questionCount: questions.length,
          rowCount: data.sample_row_count,
          scoredCount: storedResults.filter(
            (result) => result.status === "scored",
          ).length,
          unableCount: storedResults.filter(
            (result) => result.status === "unable",
          ).length,
        }
      : null;

  return {
    approvedAt: data.approved_at,
    completion,
    expiresAt: data.expires_at,
    failure: {
      code: data.error_code,
      requestMade: readRequestCount(data.inference_diagnostics) > 0,
    },
    id: data.id,
    questions,
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
      "id, title, status, contracts, results, inference_diagnostics, error_code, completed_at, approved_at, expires_at",
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

  const questions = readStoredQuestions(data.contracts);
  const diagnostics = readRunDiagnostics(data.inference_diagnostics);
  const storedResults = data.results as EvaluationResult[] | null;
  const verifiedComplete =
    data.status === "complete" &&
    isAtomicVerifiedResultSet(
      questions,
      storedResults,
      diagnostics,
    );

  return {
    approvedAt: data.approved_at,
    completion: null,
    completedAt: data.completed_at,
    errorCode: data.error_code,
    expiresAt: data.expires_at,
    failure: {
      code: data.error_code,
      requestMade: diagnostics.requestCount.made > 0,
    },
    id: data.id,
    inferenceDiagnostics: diagnostics,
    questions,
    results: verifiedComplete
      ? storedResults.map(toBuyerQuestionResult)
      : null,
    status: data.status as EvaluationStatus,
    title: data.title,
    verifiedComplete,
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
      completed_at: null,
      error_code: null,
      inference_diagnostics:
        toStoredRunDiagnostics(emptyEvaluationRunDiagnostics()),
      results: null,
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
  const questions = result.questionIds.map((questionId) => ({
    id: questionId,
    question: "",
  }));

  if (
    !isAtomicVerifiedResultSet(
      questions,
      result.results,
      result.inferenceDiagnostics,
    )
  ) {
    throw new EvaluationRepositoryError(
      "Only a complete, verified 0G result set can be published.",
      "conflict",
    );
  }

  const { data, error } = await client
    .from("evaluations")
    .update({
      completed_at: now.toISOString(),
      error_code: null,
      inference_diagnostics:
        toStoredRunDiagnostics(result.inferenceDiagnostics),
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
        toStoredRunDiagnostics(inferenceDiagnostics),
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

function readStoredQuestions(value: Json): EvaluationQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  if (value.every(isEvaluationQuestion)) {
    return value as unknown as EvaluationQuestion[];
  }

  return value.flatMap((item) => {
    if (
      isRecord(item) &&
      typeof item.questionId === "string" &&
      typeof item.originalQuestion === "string"
    ) {
      return [
        {
          id: item.questionId,
          question: item.originalQuestion,
        },
      ];
    }

    return [];
  });
}

function isEvaluationQuestion(value: Json) {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.question === "string" &&
    !("method" in value)
  );
}

function isRecord(value: Json): value is Record<string, Json> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function toBuyerQuestionResult(
  result: EvaluationResult,
): BuyerQuestionResult {
  if (result.status === "unable") {
    return {
      confidence: result.confidence,
      evaluatedBy: "0g",
      explanation:
        "0G could not identify enough relevant evidence in the submitted sample to score this question safely.",
      questionId: result.questionId,
      score: null,
      status: "unable",
      teeVerified: true,
    };
  }

  return {
    confidence: result.confidence,
    evaluatedBy: "0g",
    explanation: scoreSummary(result.score),
    questionId: result.questionId,
    score: result.score,
    status: "scored",
    teeVerified: true,
  };
}

export function toStoredRunDiagnostics(
  diagnostics: EvaluationRunDiagnostics,
): Json {
  return {
    requestCount: { ...diagnostics.requestCount },
    requests: diagnostics.requests.map((request) => ({
      ...request,
      billing: { ...request.billing },
      usage: { ...request.usage },
    })),
  } as Json;
}

function scoreSummary(score: number) {
  if (score === 100) {
    return "The submitted sample fully met this requirement.";
  }

  if (score >= 80) {
    return "The submitted sample strongly met this requirement.";
  }

  if (score >= 60) {
    return "The submitted sample mostly met this requirement.";
  }

  if (score >= 40) {
    return "The submitted sample partially met this requirement.";
  }

  if (score > 0) {
    return "The submitted sample rarely met this requirement.";
  }

  return "The submitted sample did not meet this requirement.";
}

function readRunDiagnostics(value: Json | null) {
  if (!value || !isRecord(value)) {
    return emptyEvaluationRunDiagnostics();
  }

  return value as unknown as EvaluationRunDiagnostics;
}

function readRequestCount(value: Json | null) {
  const diagnostics = readRunDiagnostics(value);
  return Number.isSafeInteger(diagnostics.requestCount?.made)
    ? diagnostics.requestCount.made
    : 0;
}

function databaseError(message: string, cause: unknown) {
  return new EvaluationRepositoryError(message, "database_error", {
    cause,
  });
}
