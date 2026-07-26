import {
  parseCsvSample,
  type ParsedCsvSample,
} from "../csv/parse-sample";
import { generateFreshEvaluationPlans } from "../evaluation-plans/generate";
import type {
  EvaluationQuestion,
  GeneratedEvaluationPlan,
} from "../evaluation-plans/types";
import { emitInferenceRunEvents } from "../observability/inference";
import {
  PrivateScoringError,
  scorePrivateCsvSample,
} from "../scoring/score-sample";
import {
  diagnosticsFromClientError,
  emptyEvaluationRunDiagnostics,
  type EvaluationRunDiagnostics,
} from "../scoring/run-diagnostics";
import {
  beginSellerSubmission,
  completeEvaluation,
  type CompletedEvaluationResult,
  failEvaluation,
  getSellerEvaluation,
  type SellerEvaluationView,
} from "../supabase/evaluations";
import { ZeroGClientError } from "../zero-g/client";

type SubmissionDependencies = {
  beginSubmission: (input: {
    id: string;
    sampleColumnCount: number;
    sampleRowCount: number;
    token: string;
  }) => Promise<boolean>;
  complete: (
    id: string,
    result: CompletedEvaluationResult,
  ) => Promise<void>;
  emitInferenceEvents: typeof emitInferenceRunEvents;
  fail: (
    id: string,
    errorCode: string,
    diagnostics: EvaluationRunDiagnostics,
  ) => Promise<void>;
  getSellerView: (
    id: string,
    token: string,
  ) => Promise<SellerEvaluationView | null>;
  planQuestions: (
    questions: EvaluationQuestion[],
    sample: ParsedCsvSample,
  ) => GeneratedEvaluationPlan[];
  parseSample: (bytes: Uint8Array) => ParsedCsvSample;
  scoreSample: typeof scorePrivateCsvSample;
};

const DEFAULT_DEPENDENCIES: SubmissionDependencies = {
  beginSubmission: beginSellerSubmission,
  complete: completeEvaluation,
  emitInferenceEvents: emitInferenceRunEvents,
  fail: failEvaluation,
  getSellerView: getSellerEvaluation,
  planQuestions: generateFreshEvaluationPlans,
  parseSample: parseCsvSample,
  scoreSample: scorePrivateCsvSample,
};

export class SampleSubmissionError extends Error {
  constructor(
    message: string,
    readonly code:
      | "already_processing"
      | "evaluation_unavailable"
      | "result_persistence_failed"
      | "scoring_failed",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "SampleSubmissionError";
  }
}

export async function submitPrivateSample(
  input: {
    bytes: Uint8Array;
    evaluationId: string;
    sellerToken: string;
  },
  dependencies: SubmissionDependencies = DEFAULT_DEPENDENCIES,
): Promise<{ status: "complete" }> {
  const sellerView = await dependencies.getSellerView(
    input.evaluationId,
    input.sellerToken,
  );

  if (!sellerView) {
    throw new SampleSubmissionError(
      "This seller link is invalid or expired.",
      "evaluation_unavailable",
    );
  }

  const sample = dependencies.parseSample(input.bytes);
  const claimed = await dependencies.beginSubmission({
    id: input.evaluationId,
    sampleColumnCount: sample.columnCount,
    sampleRowCount: sample.rowCount,
    token: input.sellerToken,
  });

  if (!claimed) {
    throw new SampleSubmissionError(
      "This evaluation is already processing or complete.",
      "already_processing",
    );
  }

  let result: CompletedEvaluationResult;

  try {
    const plans = dependencies.planQuestions(
      sellerView.questions,
      sample,
    );
    const scoring = await dependencies.scoreSample(
      plans,
      sample,
    );
    result = {
      inferenceDiagnostics: scoring.diagnostics,
      plans,
      results: scoring.results,
      sampleColumnCount: sample.columnCount,
      sampleRowCount: sample.rowCount,
    };
  } catch (error) {
    return recordFailure(
      dependencies,
      input.evaluationId,
      scoringFailureCode(error),
      scoringDiagnostics(error),
      error,
    );
  }

  try {
    await dependencies.complete(input.evaluationId, result);
    dependencies.emitInferenceEvents(
      input.evaluationId,
      "complete",
      result.inferenceDiagnostics,
    );
  } catch (error) {
    try {
      await dependencies.fail(
        input.evaluationId,
        "result_persistence_failed",
        result.inferenceDiagnostics,
      );
    } catch {
      // The original persistence failure is the actionable error.
    }

    throw new SampleSubmissionError(
      "The verified result could not be stored.",
      "result_persistence_failed",
      { cause: error },
    );
  }

  return { status: "complete" };
}

async function recordFailure(
  dependencies: SubmissionDependencies,
  evaluationId: string,
  errorCode: string,
  diagnostics: EvaluationRunDiagnostics,
  cause: unknown,
): Promise<never> {
  try {
    await dependencies.fail(evaluationId, errorCode, diagnostics);
    dependencies.emitInferenceEvents(
      evaluationId,
      "failed",
      diagnostics,
    );
  } catch (failureError) {
    throw new SampleSubmissionError(
      "Scoring failed and its status could not be stored.",
      "result_persistence_failed",
      { cause: failureError },
    );
  }

  throw new SampleSubmissionError(
    "The private sample could not be scored.",
    "scoring_failed",
    { cause },
  );
}

function scoringFailureCode(error: unknown) {
  const cause =
    error instanceof PrivateScoringError ? error.cause : error;

  if (cause instanceof ZeroGClientError) {
    switch (cause.code) {
      case "unverified_response":
        return "tee_verification_failed";
      case "invalid_response":
        return "zero_g_invalid_response";
      case "configuration_error":
        return "service_misconfigured";
      case "request_failed":
        return "zero_g_unavailable";
    }
  }

  return "scoring_failed";
}

function scoringDiagnostics(error: unknown) {
  if (error instanceof PrivateScoringError) {
    return error.diagnostics;
  }

  if (error instanceof ZeroGClientError) {
    return diagnosticsFromClientError(error);
  }

  return emptyEvaluationRunDiagnostics();
}
