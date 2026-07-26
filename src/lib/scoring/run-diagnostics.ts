import {
  ZeroGClientError,
  type VerifiedCompletion,
  type ZeroGRequestDiagnostics,
} from "../zero-g/client";
import { MAXIMUM_INFERENCE_REQUESTS_PER_EVALUATION } from "../zero-g/request-budget";

export type SemanticInferencePass = "original" | "repeat";

export type InferenceRequestAudit = ZeroGRequestDiagnostics & {
  model: string | null;
  pass: SemanticInferencePass | null;
  provider: string | null;
  questionId: string | null;
  requestId: string | null;
  teeVerified: boolean | null;
};

export type EvaluationRunDiagnostics = {
  requestCount: {
    made: number;
    maximum: number;
  };
  requests: InferenceRequestAudit[];
};

export class InferenceAuditRecorder {
  private readonly requests: InferenceRequestAudit[] = [];

  recordCompletion(
    questionId: string,
    pass: SemanticInferencePass,
    completion: VerifiedCompletion,
  ) {
    for (const diagnostics of completion.diagnostics) {
      this.requests.push({
        ...diagnostics,
        model: completion.trace.model,
        pass,
        provider: completion.trace.provider,
        questionId,
        requestId: completion.trace.requestId,
        teeVerified: completion.trace.teeVerified,
      });
    }
  }

  recordError(
    questionId: string,
    pass: SemanticInferencePass,
    error: unknown,
  ) {
    if (!(error instanceof ZeroGClientError)) {
      return;
    }

    for (const diagnostics of error.diagnostics) {
      this.requests.push({
        ...diagnostics,
        model: null,
        pass,
        provider: null,
        questionId,
        requestId: null,
        teeVerified:
          diagnostics.outcome === "unverified_response" ? false : null,
      });
    }
  }

  snapshot(requestCount: EvaluationRunDiagnostics["requestCount"]) {
    return {
      requestCount: { ...requestCount },
      requests: this.requests.map((request) => ({
        ...request,
        billing: { ...request.billing },
        usage: { ...request.usage },
      })),
    };
  }
}

export function emptyEvaluationRunDiagnostics(): EvaluationRunDiagnostics {
  return {
    requestCount: {
      made: 0,
      maximum: MAXIMUM_INFERENCE_REQUESTS_PER_EVALUATION,
    },
    requests: [],
  };
}

export function diagnosticsFromClientError(
  error: ZeroGClientError,
): EvaluationRunDiagnostics {
  return {
    requestCount: {
      made: error.diagnostics.length,
      maximum: error.diagnostics.length,
    },
    requests: error.diagnostics.map((diagnostics) => ({
      ...diagnostics,
      billing: { ...diagnostics.billing },
      model: null,
      pass: null,
      provider: null,
      questionId: null,
      requestId: null,
      teeVerified:
        diagnostics.outcome === "unverified_response" ? false : null,
      usage: { ...diagnostics.usage },
    })),
  };
}
