import type { ParsedCsvSample } from "../csv/parse-sample";
import type { EvaluationQuestion } from "../evaluation-plans/types";
import {
  requestVerifiedPrivateCompletion,
  type VerifiedCompletion,
  type ZeroGMessage,
} from "../zero-g/client";
import { buildEvaluationMessages } from "./evaluation-prompt";
import { parseEvaluationOutput } from "./evaluation-output";
import {
  diagnosticsFromClientError,
  diagnosticsFromCompletion,
  emptyEvaluationRunDiagnostics,
  type EvaluationRunDiagnostics,
} from "./run-diagnostics";
import type { EvaluationResult } from "./types";
import { ZeroGClientError } from "../zero-g/client";

type CompletionRequester = (
  messages: ZeroGMessage[],
) => Promise<VerifiedCompletion>;

type ScoringOptions = {
  requestCompletion?: CompletionRequester;
};

export type PrivateScoringResult = {
  diagnostics: EvaluationRunDiagnostics;
  inferenceRequests: {
    made: 1;
    maximum: 1;
  };
  results: EvaluationResult[];
};

export class PrivateScoringError extends Error {
  constructor(
    readonly diagnostics: EvaluationRunDiagnostics,
    options: ErrorOptions,
  ) {
    super("The atomic 0G evaluation did not complete.", options);
    this.name = "PrivateScoringError";
  }
}

export async function scorePrivateCsvSample(
  input: {
    evaluationId: string;
    questions: EvaluationQuestion[];
    sample: ParsedCsvSample;
  },
  options: ScoringOptions = {},
): Promise<PrivateScoringResult> {
  if (input.questions.length < 1) {
    throw new PrivateScoringError(emptyEvaluationRunDiagnostics(), {
      cause: new Error("At least one buyer question is required."),
    });
  }

  const messages = buildEvaluationMessages(input);
  const requestCompletion =
    options.requestCompletion ??
    ((requestMessages) =>
      requestVerifiedPrivateCompletion(requestMessages, {
        disableThinking: true,
        maxTokens: outputTokenLimit(
          input.questions.length,
          input.sample.rowCount,
        ),
        responseFormat: "json_object",
      }));
  let completion: VerifiedCompletion;

  try {
    completion = await requestCompletion(messages);
  } catch (error) {
    throw new PrivateScoringError(
      error instanceof ZeroGClientError
        ? diagnosticsFromClientError(error)
        : {
            requestCount: { made: 1, maximum: 1 },
            requests: [],
          },
      { cause: error },
    );
  }

  const diagnostics = diagnosticsFromCompletion(completion);

  try {
    const results = parseEvaluationOutput({
      content: completion.content,
      evaluationId: input.evaluationId,
      questions: input.questions,
      sample: input.sample,
      trace: completion.trace,
    });

    return {
      diagnostics,
      inferenceRequests: { made: 1, maximum: 1 },
      results,
    };
  } catch (error) {
    throw new PrivateScoringError(diagnostics, { cause: error });
  }
}

function outputTokenLimit(questionCount: number, rowCount: number) {
  return Math.min(4_096, 700 + questionCount * 320 + rowCount * 24);
}
