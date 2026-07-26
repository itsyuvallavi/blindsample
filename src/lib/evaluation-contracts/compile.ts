import { PRODUCT_LIMITS } from "../product-contract";
import {
  EVALUATION_CONTRACT_VERSION,
  type EvaluationContract,
  type EvaluationCriterion,
  type ScoreAnchors,
} from "./types";

const QUESTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MINIMUM_SEMANTIC_RECORDS = 3;
const MINIMUM_SEMANTIC_COVERAGE = 0.8;
const MINIMUM_OBJECTIVE_COVERAGE = 0.8;

const PERCENTAGE_ANCHORS: ScoreAnchors = {
  "1": "Almost none of the generated evidence requirement is satisfied.",
  "25": "25% of the generated evidence requirement is satisfied.",
  "50": "50% of the generated evidence requirement is satisfied.",
  "75": "75% of the generated evidence requirement is satisfied.",
  "100": "100% of the generated evidence requirement is satisfied.",
};

const SEMANTIC_ANCHORS: ScoreAnchors = {
  "1": "The record clearly does not answer the buyer's question.",
  "25": "The record provides weak or mostly irrelevant evidence.",
  "50": "The record provides partial or genuinely mixed evidence.",
  "75": "The record provides strong evidence with a limited gap.",
  "100": "The record clearly and specifically answers the buyer's question.",
};

export class EvaluationContractError extends Error {
  constructor(
    message: string,
    readonly code:
      | "clarification_required"
      | "invalid_contract"
      | "semantic_criterion_required",
  ) {
    super(message);
    this.name = "EvaluationContractError";
  }
}

export function compileEvaluationContracts(
  value: unknown,
  options: { requireSemantic?: boolean } = {},
): EvaluationContract[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > PRODUCT_LIMITS.maximumQuestions
  ) {
    throw new EvaluationContractError(
      `Provide between 1 and ${PRODUCT_LIMITS.maximumQuestions} measurable criteria.`,
      "invalid_contract",
    );
  }

  const ids = new Set<string>();
  const contracts = value.map((draft, index) =>
    compileCriterionDraft(draft, index, ids),
  );
  const semanticCount = contracts.filter(
    (contract) => contract.method === "semantic",
  ).length;

  if (semanticCount > PRODUCT_LIMITS.maximumSemanticCriteria) {
    throw new EvaluationContractError(
      `Use no more than ${PRODUCT_LIMITS.maximumSemanticCriteria} semantic criteria per evaluation.`,
      "invalid_contract",
    );
  }

  if (options.requireSemantic !== false && semanticCount === 0) {
    throw new EvaluationContractError(
      "Add at least one semantic relevance criterion so this 0G evaluation has a load-bearing private-compute step.",
      "semantic_criterion_required",
    );
  }

  return contracts;
}

function compileCriterionDraft(
  value: unknown,
  index: number,
  ids: Set<string>,
): EvaluationContract {
  if (!isRecord(value) || typeof value.kind !== "string") {
    throw clarification(
      index,
      "Choose a supported metric and provide its required settings.",
    );
  }

  const base = validateBase(value, index, ids);

  switch (value.kind) {
    case "completeness": {
      requireExactKeys(value, ["columns", "id", "kind", "question"], index);
      const columns = normalizeColumns(value.columns, index);
      return objectiveContract(
        base,
        { columns, kind: "completeness" },
        `Completeness rate across ${formatList(columns)}.`,
        columns,
        [
          "Non-empty cell count across every submitted record and approved column.",
          "Total possible cell count for those records and columns.",
        ],
        [
          "Any approved column is absent.",
        ],
        { coverageRatio: 1 },
      );
    }
    case "format_validity": {
      requireExactKeys(
        value,
        ["column", "format", "id", "kind", "question"],
        index,
      );
      const column = normalizeColumn(value.column, index);
      const format = validateFormat(value.format, index);
      return objectiveContract(
        base,
        { column, format, kind: "format_validity" },
        `${formatLabel(format)} validity rate in ${column}.`,
        [column],
        [
          `Non-empty values in ${column}.`,
          `Values matching the documented ${formatLabel(format)} validator.`,
        ],
        [
          `Column ${column} is absent.`,
          "Fewer than 80% of submitted records contain a value to validate.",
        ],
      );
    }
    case "uniqueness": {
      requireExactKeys(value, ["column", "id", "kind", "question"], index);
      const column = normalizeColumn(value.column, index);
      return objectiveContract(
        base,
        { column, kind: "uniqueness" },
        `Uniqueness rate in ${column}.`,
        [column],
        [
          `Non-empty values in ${column}.`,
          "Count of distinct values compared with evaluable values.",
        ],
        [
          `Column ${column} is absent.`,
          "Fewer than 80% of submitted records contain a value to compare.",
        ],
      );
    }
    case "date_freshness": {
      requireExactKeys(
        value,
        [
          "column",
          "id",
          "kind",
          "maximumAgeDays",
          "question",
          "referenceDate",
        ],
        index,
      );
      const column = normalizeColumn(value.column, index);
      const maximumAgeDays = integerInRange(
        value.maximumAgeDays,
        1,
        36_500,
        index,
        "Maximum age",
      );
      const referenceDate = validateIsoDate(value.referenceDate, index);
      return objectiveContract(
        base,
        {
          column,
          kind: "date_freshness",
          maximumAgeDays,
          referenceDate,
        },
        `Date freshness in ${column}: within ${maximumAgeDays} days of ${referenceDate}.`,
        [column],
        [
          `ISO dates in ${column}.`,
          `Share within ${maximumAgeDays} days before ${referenceDate}.`,
        ],
        [
          `Column ${column} is absent.`,
          "Fewer than 80% of submitted records contain a valid ISO date.",
        ],
      );
    }
    case "numeric_range": {
      requireExactKeys(
        value,
        ["column", "id", "kind", "maximum", "minimum", "question"],
        index,
      );
      const column = normalizeColumn(value.column, index);
      const minimum = finiteNumber(value.minimum, index, "Minimum");
      const maximum = finiteNumber(value.maximum, index, "Maximum");

      if (minimum >= maximum) {
        throw clarification(index, "Set a maximum greater than the minimum.");
      }

      return objectiveContract(
        base,
        { column, kind: "numeric_range", maximum, minimum },
        `Numeric range coverage in ${column}: ${minimum} through ${maximum}, inclusive.`,
        [column],
        [
          `Numeric values in ${column}.`,
          `Share within ${minimum}–${maximum}, inclusive.`,
        ],
        [
          `Column ${column} is absent.`,
          "Fewer than 80% of submitted records contain a finite number.",
        ],
      );
    }
    case "column_availability": {
      requireExactKeys(value, ["columns", "id", "kind", "question"], index);
      const columns = normalizeColumns(value.columns, index);
      return objectiveContract(
        base,
        { columns, kind: "column_availability" },
        `Availability of approved columns: ${formatList(columns)}.`,
        [],
        [
          "Case-insensitive comparison of approved column names with submitted CSV headers.",
        ],
        ["The approved contract contains no column names."],
        { coverageRatio: 1 },
      );
    }
    case "category_coverage": {
      requireExactKeys(
        value,
        ["column", "expectedValues", "id", "kind", "question"],
        index,
      );
      const column = normalizeColumn(value.column, index);
      const expectedValues = normalizeTextList(
        value.expectedValues,
        index,
        "expected categories",
        2,
      );
      return objectiveContract(
        base,
        { column, expectedValues, kind: "category_coverage" },
        `Coverage of approved categories in ${column}: ${formatList(expectedValues)}.`,
        [column],
        [
          `Non-empty values in ${column}.`,
          "Share of approved categories represented at least once.",
        ],
        [
          `Column ${column} is absent.`,
          "Fewer than 80% of submitted records contain a category value.",
        ],
      );
    }
    case "semantic_relevance": {
      requireExactKeys(
        value,
        ["columns", "controls", "id", "kind", "question", "target"],
        index,
      );
      const columns = normalizeColumns(value.columns, index);
      const target = boundedText(
        value.target,
        10,
        PRODUCT_LIMITS.maximumQuestionCharacters,
        index,
        "Semantic target",
      );
      const controls = validateControls(value.controls, index);

      return {
        aggregationMethod: "server_mean_rubric_points",
        contractVersion: EVALUATION_CONTRACT_VERSION,
        criterion: {
          columns,
          controls,
          kind: "semantic_relevance",
          target,
        },
        method: "semantic",
        minimumEvidence: {
          coverageRatio: MINIMUM_SEMANTIC_COVERAGE,
          records: MINIMUM_SEMANTIC_RECORDS,
        },
        normalizedCriterion: `Record-level answer quality using ${formatList(columns)} for: ${target}`,
        originalQuestion: base.question,
        populationRule: "all_submitted_records_no_sampling",
        questionId: base.id,
        requiredColumns: columns,
        requiredEvidence: [
          "One rubric classification per submitted record using only the generated evidence columns.",
          "BlindSample-generated negative, intermediate, and positive controls.",
          "A deterministic repeated subset with at least 80% classification agreement.",
        ],
        scoringAnchors: SEMANTIC_ANCHORS,
        unableToScoreConditions: [
          "Any generated evidence column is absent.",
          `Fewer than ${MINIMUM_SEMANTIC_RECORDS} submitted records contain evaluable evidence.`,
          "Evidence coverage is below 80%.",
          "Any internal calibration control is classified incorrectly.",
          "Repeated classification agreement is below 80%.",
          "Any 0G response is not TEE verified.",
        ],
      };
    }
    default:
      throw clarification(
        index,
        "Choose completeness, format validity, uniqueness, date freshness, numeric range, column availability, category coverage, or semantic relevance.",
      );
  }
}

function objectiveContract(
  base: { id: string; question: string },
  criterion: EvaluationCriterion,
  normalizedCriterion: string,
  requiredColumns: string[],
  requiredEvidence: string[],
  unableToScoreConditions: string[],
  minimumEvidence: { coverageRatio?: number; records?: number } = {},
): EvaluationContract {
  return {
    aggregationMethod: "server_percentage_to_score",
    contractVersion: EVALUATION_CONTRACT_VERSION,
    criterion,
    method: "deterministic",
    minimumEvidence: {
      coverageRatio:
        minimumEvidence.coverageRatio ?? MINIMUM_OBJECTIVE_COVERAGE,
      records: minimumEvidence.records ?? 1,
    },
    normalizedCriterion,
    originalQuestion: base.question,
    populationRule: "all_submitted_records_no_sampling",
    questionId: base.id,
    requiredColumns,
    requiredEvidence,
    scoringAnchors: PERCENTAGE_ANCHORS,
    unableToScoreConditions,
  };
}

function validateBase(
  value: Record<string, unknown>,
  index: number,
  ids: Set<string>,
) {
  if (
    typeof value.id !== "string" ||
    !QUESTION_ID_PATTERN.test(value.id)
  ) {
    throw new EvaluationContractError(
      `Criterion ${index + 1} has an invalid ID.`,
      "invalid_contract",
    );
  }

  if (ids.has(value.id)) {
    throw new EvaluationContractError(
      "Criterion IDs must be unique.",
      "invalid_contract",
    );
  }

  const question = boundedText(
    value.question,
    1,
    PRODUCT_LIMITS.maximumQuestionCharacters,
    index,
    "Buyer question",
  );
  ids.add(value.id);

  return { id: value.id, question };
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: string[],
  index: number,
) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();

  if (
    actual.length !== sortedExpected.length ||
    !actual.every((key, keyIndex) => key === sortedExpected[keyIndex])
  ) {
    throw clarification(
      index,
      "Complete only the settings required by the selected metric.",
    );
  }
}

function normalizeColumns(value: unknown, index: number) {
  return normalizeTextList(value, index, "column names", 1);
}

function normalizeTextList(
  value: unknown,
  index: number,
  label: string,
  minimumItems: number,
) {
  if (
    !Array.isArray(value) ||
    value.length < minimumItems ||
    value.length > PRODUCT_LIMITS.maximumColumns
  ) {
    throw clarification(
      index,
      `Provide ${minimumItems}–${PRODUCT_LIMITS.maximumColumns} ${label}.`,
    );
  }

  const normalized = value.map((item) =>
    boundedText(item, 1, 120, index, label),
  );
  const canonical = normalized.map((item) =>
    item.toLocaleLowerCase("en-US"),
  );

  if (new Set(canonical).size !== canonical.length) {
    throw clarification(index, `Use unique ${label}.`);
  }

  return normalized;
}

function normalizeColumn(value: unknown, index: number) {
  return boundedText(value, 1, 120, index, "Column name");
}

function validateFormat(value: unknown, index: number) {
  const formats = ["email", "iso_date", "number", "url", "uuid"] as const;

  if (!formats.includes(value as (typeof formats)[number])) {
    throw clarification(index, "Choose a supported value format.");
  }

  return value as (typeof formats)[number];
}

function validateIsoDate(value: unknown, index: number) {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    throw clarification(index, "Use a reference date in YYYY-MM-DD format.");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw clarification(index, "Use a real reference date.");
  }

  return value;
}

function validateControls(value: unknown, index: number) {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["intermediate", "negative", "positive"])
  ) {
    throw clarification(
      index,
      "Provide buyer-reviewed negative, intermediate, and positive control examples.",
    );
  }

  const controls = {
    intermediate: boundedText(
      value.intermediate,
      1,
      300,
      index,
      "Intermediate control",
    ),
    negative: boundedText(
      value.negative,
      1,
      300,
      index,
      "Negative control",
    ),
    positive: boundedText(
      value.positive,
      1,
      300,
      index,
      "Positive control",
    ),
  };
  const unique = new Set(
    Object.values(controls).map((control) =>
      control.toLocaleLowerCase("en-US"),
    ),
  );

  if (unique.size !== 3) {
    throw clarification(index, "Use three distinct control examples.");
  }

  return controls;
}

function finiteNumber(value: unknown, index: number, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw clarification(index, `${label} must be a finite number.`);
  }

  return value;
}

function integerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  index: number,
  label: string,
) {
  if (
    !Number.isInteger(value) ||
    Number(value) < minimum ||
    Number(value) > maximum
  ) {
    throw clarification(
      index,
      `${label} must be an integer from ${minimum} to ${maximum}.`,
    );
  }

  return Number(value);
}

function boundedText(
  value: unknown,
  minimum: number,
  maximum: number,
  index: number,
  label: string,
) {
  if (typeof value !== "string") {
    throw clarification(index, `${label} must be text.`);
  }

  const normalized = value.trim();

  if (normalized.length < minimum || normalized.length > maximum) {
    throw clarification(
      index,
      `${label} must contain ${minimum}–${maximum} characters.`,
    );
  }

  return normalized;
}

function clarification(index: number, detail: string) {
  return new EvaluationContractError(
    `Criterion ${index + 1} needs clarification. ${detail}`,
    "clarification_required",
  );
}

function formatLabel(value: string) {
  return value.replace("_", " ");
}

function formatList(values: string[]) {
  return values.join(", ");
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: string[],
) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();

  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
