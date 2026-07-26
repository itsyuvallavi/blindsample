import {
  ZeroGClientError,
  type ZeroGRequestDiagnostics,
} from "../zero-g/client";
import type { InferenceRequestAudit } from "./run-diagnostics";
import type {
  EvaluationExecutionError,
  EvaluationResult,
} from "./types";

export function executionErrorFromFailure(
  error: unknown,
): EvaluationExecutionError {
  if (!(error instanceof ZeroGClientError)) {
    return {
      code: "private_compute_execution_failed",
      httpStatus: null,
      outcome: null,
      requestMade: false,
    };
  }

  const diagnostic = error.diagnostics.at(-1);

  if (error.code === "configuration_error") {
    return {
      code: "private_compute_configuration_failed",
      httpStatus: null,
      outcome: null,
      requestMade: false,
    };
  }

  if (error.code === "unverified_response") {
    return fromDiagnostic(
      diagnostic,
      "private_compute_verification_failed",
    );
  }

  if (error.code === "invalid_response") {
    return fromDiagnostic(
      diagnostic,
      "private_compute_invalid_response",
    );
  }

  return fromDiagnostic(diagnostic);
}

export function normalizeLegacyExecutionErrors(
  results: EvaluationResult[],
  requests: InferenceRequestAudit[],
): EvaluationResult[] {
  return results.map((result) => {
    if (
      result.status !== "unable_to_score" ||
      result.reason !== "model_or_verification_failed"
    ) {
      return result;
    }

    const request = requests
      .filter((candidate) => candidate.questionId === result.questionId)
      .at(-1);

    return {
      error: fromDiagnostic(request),
      evidence: {
        ...result.evidence,
        coverageRatio: null,
        recordsEvaluated: null,
      },
      questionId: result.questionId,
      score: null,
      status: "error",
    };
  });
}

function fromDiagnostic(
  diagnostic: ZeroGRequestDiagnostics | InferenceRequestAudit | undefined,
  forcedCode?: EvaluationExecutionError["code"],
): EvaluationExecutionError {
  const httpStatus = diagnostic?.httpStatus ?? null;
  const outcome =
    diagnostic?.outcome === "succeeded"
      ? null
      : diagnostic?.outcome ?? null;

  return {
    code:
      forcedCode ??
      codeFor(
        httpStatus,
        diagnostic?.outcome ?? null,
      ),
    httpStatus,
    outcome,
    requestMade: diagnostic !== undefined,
  };
}

function codeFor(
  httpStatus: number | null,
  outcome: ZeroGRequestDiagnostics["outcome"] | null,
): EvaluationExecutionError["code"] {
  if (httpStatus === 401 || httpStatus === 403) {
    return "private_compute_authentication_failed";
  }

  if (httpStatus === 429) {
    return "private_compute_rate_limited";
  }

  if (outcome === "unverified_response") {
    return "private_compute_verification_failed";
  }

  if (outcome === "invalid_response") {
    return "private_compute_invalid_response";
  }

  if (outcome === "http_error" || outcome === "network_error") {
    return "private_compute_unavailable";
  }

  return "private_compute_execution_failed";
}
