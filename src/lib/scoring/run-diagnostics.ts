import {
  ZeroGClientError,
  type VerifiedCompletion,
  type ZeroGRequestDiagnostics,
} from "../zero-g/client";

export type InferenceRequestAudit = ZeroGRequestDiagnostics & {
  model: string | null;
  provider: string | null;
  requestId: string | null;
  teeVerified: boolean | null;
};

export type EvaluationRunDiagnostics = {
  requestCount: {
    made: number;
    maximum: 1;
  };
  requests: InferenceRequestAudit[];
};

export function diagnosticsFromCompletion(
  completion: VerifiedCompletion,
): EvaluationRunDiagnostics {
  return {
    requestCount: { made: 1, maximum: 1 },
    requests: completion.diagnostics.map((diagnostics) => ({
      ...diagnostics,
      billing: { ...diagnostics.billing },
      model: completion.trace.model,
      provider: completion.trace.provider,
      requestId: completion.trace.requestId,
      teeVerified: completion.trace.teeVerified,
      usage: { ...diagnostics.usage },
    })),
  };
}

export function emptyEvaluationRunDiagnostics(): EvaluationRunDiagnostics {
  return {
    requestCount: {
      made: 0,
      maximum: 1,
    },
    requests: [],
  };
}

export function diagnosticsFromClientError(
  error: ZeroGClientError,
): EvaluationRunDiagnostics {
  return {
    requestCount: {
      made: error.diagnostics.length > 0 ? 1 : 0,
      maximum: 1,
    },
    requests: error.diagnostics.slice(0, 1).map((diagnostics) => ({
      ...diagnostics,
      billing: { ...diagnostics.billing },
      model: null,
      provider: null,
      requestId: null,
      teeVerified:
        diagnostics.outcome === "unverified_response" ? false : null,
      usage: { ...diagnostics.usage },
    })),
  };
}
