import type { ParsedCsvSample } from "../csv/parse-sample";
import type {
  EvaluationQuestion,
  EvaluationScore,
} from "../supabase/evaluations";
import {
  requestVerifiedPrivateCompletion,
  type VerifiedCompletion,
  type ZeroGMessage,
  type ZeroGTrace,
} from "../zero-g/client";
import { parseScoringOutput, ScoringOutputError } from "./output";
import {
  buildCorrectionMessage,
  buildScoringMessages,
} from "./prompt";

type CompletionRequester = (
  messages: ZeroGMessage[],
) => Promise<VerifiedCompletion>;

type ScoringOptions = {
  requestCompletion?: CompletionRequester;
};

export type PrivateScoringResult = {
  scores: EvaluationScore[];
  trace: ZeroGTrace;
};

export async function scorePrivateCsvSample(
  questions: EvaluationQuestion[],
  sample: ParsedCsvSample,
  options: ScoringOptions = {},
): Promise<PrivateScoringResult> {
  const requestCompletion =
    options.requestCompletion ??
    ((messages) =>
      requestVerifiedPrivateCompletion(messages, {
        maxTokens: Math.min(1_536, 128 + questions.length * 64),
      }));
  const messages = buildScoringMessages(questions, sample);
  const first = await requestCompletion(messages);

  try {
    return {
      scores: parseScoringOutput(first.content, questions),
      trace: first.trace,
    };
  } catch (error) {
    if (!(error instanceof ScoringOutputError)) {
      throw error;
    }
  }

  const corrected = await requestCompletion([
    ...messages,
    { content: first.content, role: "assistant" },
    buildCorrectionMessage(),
  ]);

  return {
    scores: parseScoringOutput(corrected.content, questions),
    trace: corrected.trace,
  };
}
