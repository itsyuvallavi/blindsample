import type { PrivateScoringResult } from "../scoring/score-sample";

export function buildLiveSemanticSummary(
  result: PrivateScoringResult,
  questionId: string,
) {
  const semantic = result.results.find(
    (item) => item.questionId === questionId,
  );

  return {
    inferenceRequests: { ...result.inferenceRequests },
    requests: result.diagnostics.requests.map((request) => ({
      attempt: request.attempt,
      billing: { ...request.billing },
      durationMs: request.durationMs,
      finishReason: request.finishReason,
      httpStatus: request.httpStatus,
      model: request.model,
      outcome: request.outcome,
      pass: request.pass,
      provider: request.provider,
      questionId: request.questionId,
      reasoningContentPresent: request.reasoningContentPresent,
      requestId: request.requestId,
      responseLength: request.responseLength,
      teeVerified: request.teeVerified,
      usage: { ...request.usage },
    })),
    semantic: semantic
      ? {
          agreement: { ...semantic.evidence.agreement },
          controlCheck: semantic.evidence.controlCheck,
          coverageRatio: semantic.evidence.coverageRatio,
          error:
            semantic.status === "error"
              ? { ...semantic.error }
              : null,
          reason:
            semantic.status === "unable_to_score"
              ? semantic.reason
              : null,
          semanticFailure: semantic.evidence.semanticFailure
            ? { ...semantic.evidence.semanticFailure }
            : null,
          status: semantic.status,
        }
      : {
          agreement: null,
          controlCheck: null,
          coverageRatio: null,
          error: null,
          reason: "missing_result",
          semanticFailure: null,
          status: "missing",
        },
  };
}
