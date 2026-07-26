import type { ParsedCsvSample } from "../csv/parse-sample";
import type { EvaluationContract } from "../evaluation-contracts/types";
import { isValidScore } from "../product-contract";
import {
  requestVerifiedPrivateCompletion,
  type VerifiedCompletion,
  type ZeroGMessage,
  type ZeroGTrace,
} from "../zero-g/client";
import type { InferenceRequestBudget } from "../zero-g/request-budget";
import {
  parseSemanticClassificationOutput,
  SemanticOutputError,
  type RubricLabel,
  type SemanticClassificationOutput,
} from "./semantic-output";
import {
  buildSemanticClassificationMessages,
  type SemanticControl,
} from "./semantic-prompt";
import {
  ONE_RECORD_LIMITATION,
  SUBMITTED_DATA_LIMITATION,
  type EvaluationResult,
  type ResultEvidence,
  type SemanticOutputFailure,
  type UnableToScoreReason,
  zeroGEvidence,
} from "./types";

export const SEMANTIC_RELIABILITY = {
  repeatAgreementRatio: 0.8,
  repeatSubsetSize: 5,
  requiredControlRatio: 1,
} as const;

const RUBRIC_POINTS: Record<
  Exclude<RubricLabel, "insufficient">,
  number
> = {
  intermediate: 50,
  negative: 1,
  positive: 100,
  strong: 75,
  weak: 25,
};

export type SemanticRecord = {
  recordId: string;
  values: Record<string, string>;
};

type CompletionRequester = (
  messages: ZeroGMessage[],
) => Promise<VerifiedCompletion>;

type SemanticOptions = {
  requestBudget?: InferenceRequestBudget;
  requestCompletion?: CompletionRequester;
};

export async function evaluateSemanticContract(
  contract: EvaluationContract,
  sample: ParsedCsvSample,
  options: SemanticOptions = {},
): Promise<EvaluationResult> {
  if (
    contract.method !== "semantic" ||
    contract.criterion.kind !== "semantic_relevance"
  ) {
    throw new Error("A semantic relevance contract is required.");
  }

  const missing = missingColumns(
    contract.criterion.columns,
    sample.columns,
  );

  if (missing.length > 0) {
    return unableResult(
      contract,
      sample,
      "missing_required_columns",
      0,
      0,
      [],
    );
  }

  const records = prepareSemanticRecords(contract, sample);

  if (records.length < contract.minimumEvidence.records) {
    return unableResult(
      contract,
      sample,
      "insufficient_records",
      records.length,
      ratio(records.length, sample.rowCount),
      [],
    );
  }

  const repeatRecords = records.slice(
    0,
    Math.min(SEMANTIC_RELIABILITY.repeatSubsetSize, records.length),
  );
  const controls = semanticControls(contract);
  const requestCompletion =
    options.requestCompletion ??
    ((messages) =>
      requestVerifiedPrivateCompletion(messages, {
        disableThinking: true,
        maxTokens: Math.min(2_048, 320 + records.length * 28),
        responseFormat: "json_object",
      }));
  const guardedRequest = (messages: ZeroGMessage[]) => {
    options.requestBudget?.consume();
    return requestCompletion(messages);
  };

  const original = await guardedRequest(
    buildSemanticClassificationMessages(contract, records, controls),
  );
  const traces = [verifiedTrace(original)];
  const parsedOriginal = parseCompletion(
    original,
    records.map((record) => record.recordId),
    controls.map((control) => control.controlId),
    "original",
  );

  if ("failure" in parsedOriginal) {
    return unableResult(
      contract,
      sample,
      failureReason(parsedOriginal.failure.kind),
      0,
      0,
      traces,
      {
        controlCheck: "failed",
        semanticFailure: parsedOriginal.failure,
      },
    );
  }
  const originalOutput = parsedOriginal.output;

  const repeated = await guardedRequest(
    buildSemanticClassificationMessages(
      contract,
      repeatRecords,
      controls,
    ),
  );
  traces.push(verifiedTrace(repeated));
  const parsedRepeated = parseCompletion(
    repeated,
    repeatRecords.map((record) => record.recordId),
    controls.map((control) => control.controlId),
    "repeat",
  );

  if ("failure" in parsedRepeated) {
    return unableResult(
      contract,
      sample,
      failureReason(parsedRepeated.failure.kind),
      0,
      0,
      traces,
      {
        controlCheck: "failed",
        semanticFailure: parsedRepeated.failure,
      },
    );
  }
  const repeatedOutput = parsedRepeated.output;

  const controlsPassed =
    controlRatio(originalOutput, controls) ===
      SEMANTIC_RELIABILITY.requiredControlRatio &&
    controlRatio(repeatedOutput, controls) ===
      SEMANTIC_RELIABILITY.requiredControlRatio;
  const evaluable = originalOutput.classifications.filter(
    (classification) => classification.label !== "insufficient",
  );
  const coverageRatio = ratio(evaluable.length, sample.rowCount);
  const agreementRatio = classificationAgreement(
    originalOutput,
    repeatedOutput,
  );

  if (!controlsPassed) {
    return unableResult(
      contract,
      sample,
      "control_check_failed",
      evaluable.length,
      coverageRatio,
      traces,
      {
        agreementRatio,
        controlCheck: "failed",
      },
    );
  }

  if (evaluable.length < contract.minimumEvidence.records) {
    return unableResult(
      contract,
      sample,
      "insufficient_records",
      evaluable.length,
      coverageRatio,
      traces,
      {
        agreementRatio,
        controlCheck: "passed",
      },
    );
  }

  if (
    coverageRatio + Number.EPSILON <
    contract.minimumEvidence.coverageRatio
  ) {
    return unableResult(
      contract,
      sample,
      "insufficient_coverage",
      evaluable.length,
      coverageRatio,
      traces,
      {
        agreementRatio,
        controlCheck: "passed",
      },
    );
  }

  if (
    agreementRatio + Number.EPSILON <
    SEMANTIC_RELIABILITY.repeatAgreementRatio
  ) {
    return unableResult(
      contract,
      sample,
      "unstable_classification",
      evaluable.length,
      coverageRatio,
      traces,
      {
        agreementRatio,
        controlCheck: "passed",
      },
    );
  }

  const meanRubricPoints =
    evaluable.reduce(
      (sum, classification) =>
        sum +
        RUBRIC_POINTS[
          classification.label as Exclude<
            RubricLabel,
            "insufficient"
          >
        ],
      0,
    ) / evaluable.length;
  const score = Math.round(meanRubricPoints);

  if (!isValidScore(score)) {
    throw new Error("Semantic aggregation produced an invalid score.");
  }

  return {
    evidence: evidenceFor(
      contract,
      sample,
      evaluable.length,
      coverageRatio,
      traces,
      {
        agreementRatio,
        controlCheck: "passed",
        measurement: meanRubricPoints,
      },
    ),
    questionId: contract.questionId,
    score,
    status: "scored",
  };
}

export function prepareSemanticRecords(
  contract: EvaluationContract,
  sample: ParsedCsvSample,
): SemanticRecord[] {
  const criterion = contract.criterion;

  if (contract.method !== "semantic" || criterion.kind !== "semantic_relevance") {
    throw new Error("A semantic relevance contract is required.");
  }

  const index = new Map(
    sample.columns.map((column, position) => [
      canonical(column),
      position,
    ]),
  );
  const projected = sample.rows.map((row) =>
    Object.fromEntries(
      criterion.columns.map((column) => [
        column,
        row[index.get(canonical(column)) as number] ?? "",
      ]),
    ),
  );

  return projected
    .map((values) => ({ serialized: JSON.stringify(values), values }))
    .sort((left, right) =>
      left.serialized.localeCompare(right.serialized),
    )
    .map(({ values }, position) => ({
      recordId: `record_${String(position + 1).padStart(3, "0")}`,
      values,
    }));
}

function semanticControls(
  contract: EvaluationContract,
): SemanticControl[] {
  if (contract.criterion.kind !== "semantic_relevance") {
    throw new Error("A semantic relevance contract is required.");
  }

  return [
    {
      content: contract.criterion.controls.negative,
      controlId: "control_a",
      expectedLabel: "negative",
    },
    {
      content: contract.criterion.controls.positive,
      controlId: "control_b",
      expectedLabel: "positive",
    },
    {
      content: contract.criterion.controls.intermediate,
      controlId: "control_c",
      expectedLabel: "intermediate",
    },
  ];
}

function verifiedTrace(completion: VerifiedCompletion) {
  if (completion.trace.teeVerified !== true) {
    throw new Error("Semantic inference was not TEE verified.");
  }

  return completion.trace;
}

function controlRatio(
  output: SemanticClassificationOutput,
  controls: SemanticControl[],
) {
  const expected = new Map(
    controls.map((control) => [
      control.controlId,
      control.expectedLabel,
    ]),
  );
  const passing = output.controls.filter(
    (control) => expected.get(control.controlId) === control.label,
  ).length;

  return ratio(passing, controls.length);
}

function classificationAgreement(
  original: SemanticClassificationOutput,
  repeated: SemanticClassificationOutput,
) {
  const originalById = new Map(
    original.classifications.map((classification) => [
      classification.recordId,
      classification.label,
    ]),
  );
  const matching = repeated.classifications.filter(
    (classification) =>
      originalById.get(classification.recordId) === classification.label,
  ).length;

  return ratio(matching, repeated.classifications.length);
}

function unableResult(
  contract: EvaluationContract,
  sample: ParsedCsvSample,
  reason: UnableToScoreReason,
  recordsEvaluated: number,
  coverageRatio: number,
  traces: ZeroGTrace[],
  state: {
    agreementRatio?: number;
    controlCheck?: "failed" | "not_applicable" | "passed";
    semanticFailure?: SemanticOutputFailure;
  } = {},
): EvaluationResult {
  return {
    evidence: evidenceFor(
      contract,
      sample,
      recordsEvaluated,
      coverageRatio,
      traces,
      state,
    ),
    questionId: contract.questionId,
    reason,
    score: null,
    status: "unable_to_score",
  };
}

function evidenceFor(
  contract: EvaluationContract,
  sample: ParsedCsvSample,
  recordsEvaluated: number,
  coverageRatio: number,
  traces: ZeroGTrace[],
  state: {
    agreementRatio?: number;
    controlCheck?: "failed" | "not_applicable" | "passed";
    measurement?: number;
    semanticFailure?: SemanticOutputFailure;
  },
): ResultEvidence {
  const agreementRatio = state.agreementRatio;

  return {
    agreement: {
      ratio:
        agreementRatio === undefined ? null : roundRatio(agreementRatio),
      requiredRatio: SEMANTIC_RELIABILITY.repeatAgreementRatio,
      status:
        agreementRatio === undefined
          ? "not_applicable"
          : agreementRatio >=
              SEMANTIC_RELIABILITY.repeatAgreementRatio
            ? "passed"
            : "failed",
    },
    contractVersion: contract.contractVersion,
    controlCheck: state.controlCheck ?? "not_applicable",
    coverageRatio: roundRatio(coverageRatio),
    limitation:
      sample.rowCount === 1
        ? ONE_RECORD_LIMITATION
        : SUBMITTED_DATA_LIMITATION,
    measurement:
      state.measurement === undefined
        ? null
        : {
            name: "mean_rubric_points",
            unit: "rubric_points",
            value: Math.round(state.measurement * 100) / 100,
          },
    method: "semantic",
    recordsEvaluated,
    recordsSubmitted: sample.rowCount,
    semanticFailure: state.semanticFailure ?? null,
    zeroG: traces.length > 0 ? zeroGEvidence(traces) : null,
  };
}

function parseCompletion(
  completion: VerifiedCompletion,
  recordIds: string[],
  controlIds: string[],
  pass: SemanticOutputFailure["pass"],
):
  | { output: SemanticClassificationOutput }
  | { failure: SemanticOutputFailure } {
  const lastDiagnostics = completion.diagnostics?.at(-1);

  if (lastDiagnostics?.finishReason === "length") {
    return { failure: { kind: "truncated", pass } };
  }

  try {
    return {
      output: parseSemanticClassificationOutput(
        completion.content,
        recordIds,
        controlIds,
      ),
    };
  } catch (error) {
    if (!(error instanceof SemanticOutputError)) {
      throw error;
    }

    const kind =
      error.code === "empty_output"
        ? "empty"
        : error.code === "invalid_json"
          ? "invalid_json"
          : "invalid_shape";

    return { failure: { kind, pass } };
  }
}

function failureReason(
  kind: SemanticOutputFailure["kind"],
): UnableToScoreReason {
  switch (kind) {
    case "empty":
      return "semantic_output_empty";
    case "invalid_json":
      return "semantic_output_invalid_json";
    case "invalid_shape":
      return "semantic_output_invalid_shape";
    case "truncated":
      return "semantic_output_truncated";
  }
}

function missingColumns(required: string[], submitted: string[]) {
  const available = new Set(submitted.map(canonical));
  return required.filter((column) => !available.has(canonical(column)));
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function roundRatio(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

function canonical(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}
