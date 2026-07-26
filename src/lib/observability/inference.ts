import type { EvaluationRunDiagnostics } from "../scoring/run-diagnostics";

export function emitInferenceRunEvents(
  evaluationId: string,
  status: "complete" | "failed",
  diagnostics: EvaluationRunDiagnostics,
) {
  for (const request of diagnostics.requests) {
    console.info(
      JSON.stringify({
        attempt: request.attempt,
        billing: request.billing,
        durationMs: request.durationMs,
        evaluationId,
        event: "private_inference_request",
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
        status,
        teeVerified: request.teeVerified,
        usage: request.usage,
      }),
    );
  }
}
