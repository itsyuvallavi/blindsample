import type { ParsedCsvSample } from "../csv/parse-sample";
import type { EvaluationContract } from "../evaluation-contracts/types";
import type {
  VerifiedCompletion,
  ZeroGMessage,
} from "../zero-g/client";
import { InferenceRequestBudget } from "../zero-g/request-budget";
import {
  parseSemanticCompletion,
  prepareSemanticControls,
  prepareSemanticRecords,
  semanticFailureReason,
} from "../scoring/semantic";
import { buildSemanticClassificationMessages } from "../scoring/semantic-prompt";
import {
  InferenceAuditRecorder,
  type InferenceRequestAudit,
} from "../scoring/run-diagnostics";
import type {
  SemanticOutputFailure,
  UnableToScoreReason,
} from "../scoring/types";
import type { RubricLabel } from "../scoring/semantic-output";

const SINGLE_REQUEST_LIMIT = 1;

type CompletionRequester = (
  messages: ZeroGMessage[],
) => Promise<VerifiedCompletion>;

export type OriginalSemanticDiagnostic = {
  classificationCount: {
    expected: number;
    received: number | null;
  };
  controlCheck: "failed" | "not_applicable" | "passed";
  controlClassifications: {
    controlId: string;
    expectedLabel: RubricLabel;
    passed: boolean;
    returnedLabel: RubricLabel;
  }[] | null;
  coverageRatio: number | null;
  inferenceRequests: {
    made: number;
    maximum: 1;
  };
  jsonModeRespected: boolean | null;
  reason: UnableToScoreReason | "request_failed" | null;
  requests: InferenceRequestAudit[];
  semanticFailure: SemanticOutputFailure | null;
  status: "parsed" | "request_failed" | "unable_to_parse";
  strictSchemaParsed: boolean;
  thinkingDisabledObserved: boolean | null;
};

export async function runOriginalSemanticDiagnostic(
  contract: EvaluationContract,
  sample: ParsedCsvSample,
  requestCompletion: CompletionRequester,
): Promise<OriginalSemanticDiagnostic> {
  if (
    contract.method !== "semantic" ||
    contract.criterion.kind !== "semantic_relevance"
  ) {
    throw new Error("A semantic relevance contract is required.");
  }

  const records = prepareSemanticRecords(contract, sample);
  const controls = prepareSemanticControls(contract);
  const budget = new InferenceRequestBudget(SINGLE_REQUEST_LIMIT);
  const recorder = new InferenceAuditRecorder();

  budget.assertCanPlan(SINGLE_REQUEST_LIMIT);
  budget.consume();

  let completion: VerifiedCompletion;

  try {
    completion = await requestCompletion(
      buildSemanticClassificationMessages(contract, records, controls),
    );
    recorder.recordCompletion(
      contract.questionId,
      "original",
      completion,
    );
  } catch (error) {
    recorder.recordError(contract.questionId, "original", error);
    const snapshot = recorder.snapshot(budget.snapshot());

    return {
      classificationCount: {
        expected: records.length,
        received: null,
      },
      controlCheck: "not_applicable",
      controlClassifications: null,
      coverageRatio: null,
      inferenceRequests: {
        made: snapshot.requestCount.made,
        maximum: SINGLE_REQUEST_LIMIT,
      },
      jsonModeRespected: null,
      reason: "request_failed",
      requests: snapshot.requests,
      semanticFailure: null,
      status: "request_failed",
      strictSchemaParsed: false,
      thinkingDisabledObserved: thinkingObservation(snapshot.requests),
    };
  }

  const parsed = parseSemanticCompletion(
    completion,
    records.map((record) => record.recordId),
    controls.map((control) => control.controlId),
    "original",
  );
  const snapshot = recorder.snapshot(budget.snapshot());

  if ("failure" in parsed) {
    return {
      classificationCount: {
        expected: records.length,
        received: null,
      },
      controlCheck: "not_applicable",
      controlClassifications: null,
      coverageRatio: null,
      inferenceRequests: {
        made: snapshot.requestCount.made,
        maximum: SINGLE_REQUEST_LIMIT,
      },
      jsonModeRespected:
        parsed.failure.kind === "invalid_shape"
          ? true
          : parsed.failure.kind === "invalid_json"
            ? false
            : null,
      reason: semanticFailureReason(parsed.failure.kind),
      requests: snapshot.requests,
      semanticFailure: parsed.failure,
      status: "unable_to_parse",
      strictSchemaParsed: false,
      thinkingDisabledObserved: thinkingObservation(snapshot.requests),
    };
  }

  const expectedControls = new Map(
    controls.map((control) => [
      control.controlId,
      control.expectedLabel,
    ]),
  );
  const controlsPassed = parsed.output.controls.every(
    (control) =>
      expectedControls.get(control.controlId) === control.label,
  );
  const controlClassifications = parsed.output.controls.map(
    (control) => {
      const expectedLabel = expectedControls.get(control.controlId);

      if (!expectedLabel) {
        throw new Error("Parsed semantic controls are incomplete.");
      }

      return {
        controlId: control.controlId,
        expectedLabel,
        passed: expectedLabel === control.label,
        returnedLabel: control.label,
      };
    },
  );
  const evaluableRecords = parsed.output.classifications.filter(
    (classification) => classification.label !== "insufficient",
  ).length;

  return {
    classificationCount: {
      expected: records.length,
      received: parsed.output.classifications.length,
    },
    controlCheck: controlsPassed ? "passed" : "failed",
    controlClassifications,
    coverageRatio:
      records.length === 0 ? 0 : evaluableRecords / records.length,
    inferenceRequests: {
      made: snapshot.requestCount.made,
      maximum: SINGLE_REQUEST_LIMIT,
    },
    jsonModeRespected: true,
    reason: controlsPassed ? null : "control_check_failed",
    requests: snapshot.requests,
    semanticFailure: null,
    status: "parsed",
    strictSchemaParsed: true,
    thinkingDisabledObserved: thinkingObservation(snapshot.requests),
  };
}

function thinkingObservation(requests: InferenceRequestAudit[]) {
  const last = requests.at(-1);

  if (
    last?.reasoningContentPresent === true ||
    (last?.usage.reasoningTokens ?? 0) > 0
  ) {
    return false;
  }

  return last?.usage.reasoningTokens === 0 ? true : null;
}
