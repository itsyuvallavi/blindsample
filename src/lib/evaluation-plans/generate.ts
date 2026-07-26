import { createHash } from "node:crypto";

import type { ParsedCsvSample } from "../csv/parse-sample";
import { compileEvaluationContracts } from "../evaluation-contracts/compile";
import type { CriterionDraft } from "../evaluation-contracts/types";
import {
  EVALUATION_PLAN_VERSION,
  type EvaluationQuestion,
  type GeneratedEvaluationPlan,
  type PlanValidation,
} from "./types";

type PlanGenerator = (
  question: EvaluationQuestion,
  sample: ParsedCsvSample,
  context: {
    attempt: 1 | 2;
    previousMissingColumns: string[];
  },
) => GeneratedEvaluationPlan;

const QUESTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function generateEvaluationPlan(
  question: EvaluationQuestion,
  sample: ParsedCsvSample,
  context: {
    attempt: 1 | 2;
    previousMissingColumns: string[];
  } = { attempt: 1, previousMissingColumns: [] },
): GeneratedEvaluationPlan {
  const normalizedQuestion = normalizeText(question.question);
  const base = planBase(question, sample, context.attempt);

  if (
    !QUESTION_ID_PATTERN.test(question.id) ||
    normalizedQuestion.length < 12 ||
    normalizedQuestion.split(" ").filter(Boolean).length < 3
  ) {
    return unablePlan(
      base,
      "ambiguous_question",
      "The question is too ambiguous to turn into a safe evaluation.",
    );
  }

  const mentionedColumns = findRelevantColumns(
    normalizedQuestion,
    sample,
  );

  if (isCompletenessQuestion(normalizedQuestion)) {
    if (mentionedColumns.length === 0) {
      return unablePlan(
        base,
        "information_not_present",
        "The question asks about completeness, but none of the requested fields exist in the submitted CSV.",
      );
    }

    const contract = compileInternalContract({
      columns: mentionedColumns,
      id: question.id,
      kind: "completeness",
      question: question.question,
    });

    return {
      ...base,
      confidence: 1,
      contract,
      evidenceNeeded: [
        "The actual submitted headers.",
        "A non-empty-cell check for every requested field in every record.",
      ],
      explanation:
        "BlindSample matched the requested fields to the submitted headers and will calculate completeness in application code.",
      method: "deterministic",
      relevantColumns: mentionedColumns,
      scoreMeaning: {
        one: "Almost none of the requested values are present.",
        oneHundred:
          "Every requested value is present in every submitted record.",
      },
      status: "answerable",
      unableReason: null,
    };
  }

  if (isUniquenessQuestion(normalizedQuestion)) {
    if (mentionedColumns.length !== 1) {
      return unablePlan(
        base,
        mentionedColumns.length === 0
          ? "information_not_present"
          : "ambiguous_question",
        mentionedColumns.length === 0
          ? "The field requested for the uniqueness check does not exist in the submitted CSV."
          : "The uniqueness question refers to more than one field, so BlindSample cannot safely choose one.",
      );
    }

    const contract = compileInternalContract({
      column: mentionedColumns[0],
      id: question.id,
      kind: "uniqueness",
      question: question.question,
    });

    return {
      ...base,
      confidence: 1,
      contract,
      evidenceNeeded: [
        `All non-empty ${mentionedColumns[0]} values in the submitted records.`,
      ],
      explanation:
        "BlindSample will calculate the distinct-value rate in application code.",
      method: "deterministic",
      relevantColumns: mentionedColumns,
      scoreMeaning: {
        one: "Almost all evaluable values are duplicated.",
        oneHundred: "Every evaluable value is unique.",
      },
      status: "answerable",
      unableReason: null,
    };
  }

  const semanticColumns =
    mentionedColumns.length > 0
      ? mentionedColumns
      : inferTextEvidenceColumns(sample);

  if (semanticColumns.length === 0) {
    return unablePlan(
      base,
      "information_not_present",
      "The submitted CSV does not contain evidence that can safely answer this question.",
    );
  }

  const contract = compileInternalContract({
    columns: semanticColumns,
    controls: generatedControls(question.question),
    id: question.id,
    kind: "semantic_relevance",
    question: question.question,
    target: question.question.trim(),
  });
  const inferredColumns = mentionedColumns.length === 0;

  return {
    ...base,
    confidence: inferredColumns ? 0.65 : 0.9,
    contract,
    evidenceNeeded: [
      `One private rubric judgment per submitted record using only: ${semanticColumns.join(", ")}.`,
      "A repeated classification pass used to check agreement.",
      "TEE verification for every 0G response.",
    ],
    explanation: inferredColumns
      ? "BlindSample selected the text-bearing fields in the submitted sample and will evaluate each record privately."
      : "BlindSample matched the question to the submitted headers and will evaluate each record privately.",
    method: "semantic",
    relevantColumns: semanticColumns,
    scoreMeaning: {
      one: "The submitted evidence clearly does not answer the question.",
      oneHundred:
        "The submitted evidence clearly and specifically answers the question.",
    },
    status: "answerable",
    unableReason: null,
  };
}

export function generateFreshEvaluationPlans(
  questions: EvaluationQuestion[],
  sample: ParsedCsvSample,
  generator: PlanGenerator = generateEvaluationPlan,
) {
  return questions.map((question) => {
    const first = generator(question, sample, {
      attempt: 1,
      previousMissingColumns: [],
    });
    const firstValidation = validateGeneratedPlan(
      first,
      question,
      sample,
    );

    if (firstValidation.valid) {
      return first;
    }

    if (first.status === "unable") {
      return invalidPlan(question, sample, 1);
    }

    if (firstValidation.reason !== "missing_columns") {
      return invalidPlan(question, sample, 1);
    }

    const second = generator(question, sample, {
      attempt: 2,
      previousMissingColumns: firstValidation.missingColumns,
    });
    const secondValidation = validateGeneratedPlan(
      second,
      question,
      sample,
    );

    return secondValidation.valid
      ? second
      : invalidPlan(question, sample, 2);
  });
}

export function validateGeneratedPlan(
  plan: GeneratedEvaluationPlan,
  question: EvaluationQuestion,
  sample: ParsedCsvSample,
): PlanValidation {
  if (plan.datasetFingerprint !== fingerprintSample(sample)) {
    return invalid("dataset_changed");
  }

  if (
    plan.questionId !== question.id ||
    plan.originalQuestion !== question.question ||
    plan.questionFingerprint !== fingerprintQuestion(question)
  ) {
    return invalid("question_changed");
  }

  if (plan.status === "unable") {
    return plan.contract === null && plan.method === "unable"
      ? { valid: true }
      : invalid("invalid_contract");
  }

  if (
    plan.contract.questionId !== question.id ||
    plan.contract.originalQuestion !== question.question ||
    plan.contract.method !== plan.method
  ) {
    return invalid("invalid_contract");
  }

  const available = new Set(sample.columns.map(canonical));
  const referenced = [
    ...new Set([
      ...plan.relevantColumns,
      ...plan.contract.requiredColumns,
    ]),
  ];
  const missingColumns = referenced.filter(
    (column) => !available.has(canonical(column)),
  );

  if (missingColumns.length > 0) {
    return {
      missingColumns,
      reason: "missing_columns",
      valid: false,
    };
  }

  return { valid: true };
}

export function fingerprintSample(sample: ParsedCsvSample) {
  return sha256({
    columns: sample.columns,
    rows: sample.rows,
  });
}

export function fingerprintQuestion(question: EvaluationQuestion) {
  return sha256({
    id: question.id,
    question: question.question,
  });
}

function planBase(
  question: EvaluationQuestion,
  sample: ParsedCsvSample,
  generationAttempt: 1 | 2,
) {
  return {
    confidence: 0,
    datasetFingerprint: fingerprintSample(sample),
    evidenceNeeded: [] as string[],
    generationAttempt,
    originalQuestion: question.question,
    planVersion: EVALUATION_PLAN_VERSION,
    questionFingerprint: fingerprintQuestion(question),
    questionId: question.id,
    relevantColumns: [] as string[],
    scoreMeaning: {
      one: "The submitted evidence does not satisfy the question.",
      oneHundred: "The submitted evidence fully satisfies the question.",
    },
  };
}

function unablePlan(
  base: ReturnType<typeof planBase>,
  unableReason:
    | "ambiguous_question"
    | "information_not_present"
    | "invalid_generated_plan",
  explanation: string,
): GeneratedEvaluationPlan {
  return {
    ...base,
    contract: null,
    explanation,
    method: "unable",
    status: "unable",
    unableReason,
  };
}

function invalidPlan(
  question: EvaluationQuestion,
  sample: ParsedCsvSample,
  attempt: 1 | 2,
) {
  return unablePlan(
    planBase(question, sample, attempt),
    "invalid_generated_plan",
    "BlindSample could not create a safe plan from the submitted headers, so no score was attempted.",
  );
}

function invalid(
  reason: Exclude<
    Extract<PlanValidation, { valid: false }>["reason"],
    "missing_columns"
  >,
): PlanValidation {
  return { missingColumns: [], reason, valid: false };
}

function compileInternalContract(draft: CriterionDraft) {
  return compileEvaluationContracts([draft], {
    requireSemantic: false,
  })[0];
}

function findRelevantColumns(
  question: string,
  sample: ParsedCsvSample,
) {
  const selected = new Set<string>();

  for (const column of sample.columns) {
    const normalizedColumn = normalizeHeader(column);

    if (
      normalizedColumn.length > 1 &&
      question.includes(normalizedColumn)
    ) {
      selected.add(canonical(column));
    }
  }

  const aliases: Array<{
    questionTerms: string[];
    headerTerms: string[];
  }> = [
    {
      headerTerms: ["symbol", "ticker", "asset", "instrument"],
      questionTerms: ["btc", "bitcoin", "symbol", "ticker", "asset"],
    },
    {
      headerTerms: ["open", "high", "low", "close", "price"],
      questionTerms: ["price", "price movement", "ohlc"],
    },
    {
      headerTerms: ["market context", "context", "explanation", "reason"],
      questionTerms: ["market context", "context", "explanation", "reason"],
    },
    {
      headerTerms: ["timestamp", "time", "datetime", "date"],
      questionTerms: ["timestamp", "time", "minute", "date"],
    },
    {
      headerTerms: ["volume", "quantity", "amount"],
      questionTerms: ["volume", "quantity", "amount"],
    },
  ];

  for (const alias of aliases) {
    if (!alias.questionTerms.some((term) => question.includes(term))) {
      continue;
    }

    for (const column of sample.columns) {
      const normalizedColumn = normalizeHeader(column);

      if (
        alias.headerTerms.some(
          (term) =>
            normalizedColumn === term ||
            normalizedColumn.includes(term),
        )
      ) {
        selected.add(canonical(column));
      }
    }
  }

  return sample.columns.filter((column) =>
    selected.has(canonical(column)),
  );
}

function inferTextEvidenceColumns(sample: ParsedCsvSample) {
  return sample.columns
    .filter((column, index) => {
      const values = sample.rows
        .map((row) => row[index]?.trim() ?? "")
        .filter(Boolean);

      if (values.length === 0) {
        return false;
      }

      const textValues = values.filter(
        (value) => !Number.isFinite(Number(value)),
      );
      const averageLength =
        values.reduce((sum, value) => sum + value.length, 0) /
        values.length;

      return (
        textValues.length / values.length >= 0.6 &&
        averageLength >= 6
      );
    })
    .slice(0, 6);
}

function isCompletenessQuestion(question: string) {
  return (
    /\b(percentage|percent|share|proportion)\b/.test(question) &&
    /\b(contain|contains|complete|present|non empty|non-empty|missing|values?)\b/.test(
      question,
    )
  );
}

function isUniquenessQuestion(question: string) {
  return /\b(unique|uniqueness|duplicate|duplicates|distinct)\b/.test(
    question,
  );
}

function generatedControls(question: string) {
  const subject = question.trim().slice(0, 150);

  return {
    intermediate: `For "${subject}", the record contains partial or ambiguous evidence that only partly answers the question.`,
    negative: `For "${subject}", the record contains no relevant evidence and does not answer the question.`,
    positive: `For "${subject}", the record contains clear, specific evidence that fully answers the question.`,
  };
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replaceAll(/[_/.-]+/g, " ")
    .replaceAll(/\s+/g, " ");
}

function normalizeHeader(value: string) {
  return normalizeText(value);
}

function canonical(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function sha256(value: unknown) {
  return createHash("sha256")
    .update(canonicalJson(value))
    .digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${canonicalJson(item)}`,
      );

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}
