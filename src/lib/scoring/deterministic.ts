import type { ParsedCsvSample } from "../csv/parse-sample";
import type { EvaluationContract } from "../evaluation-contracts/types";
import { isValidScore } from "../product-contract";
import {
  ONE_RECORD_LIMITATION,
  SUBMITTED_DATA_LIMITATION,
  type EvaluationResult,
  type ResultEvidence,
  type UnableToScoreReason,
} from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type Metric = {
  coverageRatio: number;
  measurementName: string;
  percentage: number;
  recordsEvaluated: number;
};

export function evaluateDeterministicContract(
  contract: EvaluationContract,
  sample: ParsedCsvSample,
): EvaluationResult {
  if (contract.method !== "deterministic") {
    throw new Error("A semantic contract cannot use deterministic scoring.");
  }

  const index = columnIndex(sample.columns);
  const criterion = contract.criterion;
  const missingRequiredColumns = contract.requiredColumns.filter(
    (column) => !index.has(canonical(column)),
  );

  if (missingRequiredColumns.length > 0) {
    return unableResult(
      contract,
      sample,
      "missing_required_columns",
      0,
      0,
    );
  }

  let metric: Metric;

  switch (criterion.kind) {
    case "completeness":
      metric = completenessMetric(criterion.columns, sample, index);
      break;
    case "format_validity":
      metric = formatValidityMetric(
        criterion.column,
        criterion.format,
        sample,
        index,
      );
      break;
    case "uniqueness":
      metric = uniquenessMetric(criterion.column, sample, index);
      break;
    case "date_freshness":
      metric = freshnessMetric(
        criterion.column,
        criterion.maximumAgeDays,
        criterion.referenceDate,
        sample,
        index,
      );
      break;
    case "numeric_range":
      metric = numericRangeMetric(
        criterion.column,
        criterion.minimum,
        criterion.maximum,
        sample,
        index,
      );
      break;
    case "column_availability":
      metric = columnAvailabilityMetric(criterion.columns, sample);
      break;
    case "category_coverage":
      metric = categoryCoverageMetric(
        criterion.column,
        criterion.expectedValues,
        sample,
        index,
      );
      break;
    case "semantic_relevance":
      throw new Error(
        "A semantic contract cannot use deterministic scoring.",
      );
  }

  if (metric.recordsEvaluated < contract.minimumEvidence.records) {
    return unableResult(
      contract,
      sample,
      "insufficient_records",
      metric.recordsEvaluated,
      metric.coverageRatio,
      metric,
    );
  }

  if (
    metric.coverageRatio + Number.EPSILON <
    contract.minimumEvidence.coverageRatio
  ) {
    return unableResult(
      contract,
      sample,
      "insufficient_coverage",
      metric.recordsEvaluated,
      metric.coverageRatio,
      metric,
    );
  }

  const score = percentageToScore(metric.percentage);

  return {
    evidence: evidenceFor(
      contract,
      sample,
      metric.recordsEvaluated,
      metric.coverageRatio,
      metric,
    ),
    questionId: contract.questionId,
    score,
    status: "scored",
  };
}

function completenessMetric(
  columns: string[],
  sample: ParsedCsvSample,
  index: Map<string, number>,
): Metric {
  const positions = columns.map(
    (column) => index.get(canonical(column)) as number,
  );
  const total = sample.rowCount * positions.length;
  const present = sample.rows.reduce(
    (count, row) =>
      count +
      positions.filter((position) => isPresent(row[position])).length,
    0,
  );

  return {
    coverageRatio: 1,
    measurementName: "completeness_rate",
    percentage: percentage(present, total),
    recordsEvaluated: sample.rowCount,
  };
}

function formatValidityMetric(
  column: string,
  format: "email" | "iso_date" | "number" | "url" | "uuid",
  sample: ParsedCsvSample,
  index: Map<string, number>,
): Metric {
  return observedValueMetric(
    "format_validity_rate",
    valuesFor(column, sample, index),
    (value) => validFormat(value, format),
    sample.rowCount,
  );
}

function uniquenessMetric(
  column: string,
  sample: ParsedCsvSample,
  index: Map<string, number>,
): Metric {
  const values = valuesFor(column, sample, index).filter(isPresent);
  const canonicalValues = values.map(canonical);

  return {
    coverageRatio: ratio(values.length, sample.rowCount),
    measurementName: "uniqueness_rate",
    percentage: percentage(
      new Set(canonicalValues).size,
      values.length,
    ),
    recordsEvaluated: values.length,
  };
}

function freshnessMetric(
  column: string,
  maximumAgeDays: number,
  referenceDate: string,
  sample: ParsedCsvSample,
  index: Map<string, number>,
): Metric {
  const referenceTime = Date.parse(`${referenceDate}T00:00:00.000Z`);
  const maximumAgeMs = maximumAgeDays * 24 * 60 * 60 * 1_000;
  const parsed = valuesFor(column, sample, index)
    .map(parseIsoDate)
    .filter((value): value is number => value !== null);
  const fresh = parsed.filter(
    (value) =>
      value <= referenceTime && referenceTime - value <= maximumAgeMs,
  ).length;

  return {
    coverageRatio: ratio(parsed.length, sample.rowCount),
    measurementName: "date_freshness_rate",
    percentage: percentage(fresh, parsed.length),
    recordsEvaluated: parsed.length,
  };
}

function numericRangeMetric(
  column: string,
  minimum: number,
  maximum: number,
  sample: ParsedCsvSample,
  index: Map<string, number>,
): Metric {
  const numbers = valuesFor(column, sample, index)
    .map(parseFiniteNumber)
    .filter((value): value is number => value !== null);
  const inRange = numbers.filter(
    (value) => value >= minimum && value <= maximum,
  ).length;

  return {
    coverageRatio: ratio(numbers.length, sample.rowCount),
    measurementName: "numeric_range_rate",
    percentage: percentage(inRange, numbers.length),
    recordsEvaluated: numbers.length,
  };
}

function columnAvailabilityMetric(
  columns: string[],
  sample: ParsedCsvSample,
): Metric {
  const submitted = new Set(sample.columns.map(canonical));
  const available = columns.filter((column) =>
    submitted.has(canonical(column)),
  ).length;

  return {
    coverageRatio: 1,
    measurementName: "column_availability_rate",
    percentage: percentage(available, columns.length),
    recordsEvaluated: sample.rowCount,
  };
}

function categoryCoverageMetric(
  column: string,
  expectedValues: string[],
  sample: ParsedCsvSample,
  index: Map<string, number>,
): Metric {
  const values = valuesFor(column, sample, index).filter(isPresent);
  const observed = new Set(values.map(canonical));
  const represented = expectedValues.filter((value) =>
    observed.has(canonical(value)),
  ).length;

  return {
    coverageRatio: ratio(values.length, sample.rowCount),
    measurementName: "category_coverage_rate",
    percentage: percentage(represented, expectedValues.length),
    recordsEvaluated: values.length,
  };
}

function observedValueMetric(
  measurementName: string,
  rawValues: string[],
  predicate: (value: string) => boolean,
  submittedCount: number,
): Metric {
  const values = rawValues.filter(isPresent);
  const passing = values.filter(predicate).length;

  return {
    coverageRatio: ratio(values.length, submittedCount),
    measurementName,
    percentage: percentage(passing, values.length),
    recordsEvaluated: values.length,
  };
}

function valuesFor(
  column: string,
  sample: ParsedCsvSample,
  index: Map<string, number>,
) {
  const position = index.get(canonical(column));

  if (position === undefined) {
    return [];
  }

  return sample.rows.map((row) => row[position] ?? "");
}

function validFormat(
  value: string,
  format: "email" | "iso_date" | "number" | "url" | "uuid",
) {
  switch (format) {
    case "email":
      return EMAIL_PATTERN.test(value.trim());
    case "iso_date":
      return parseIsoDate(value) !== null;
    case "number":
      return parseFiniteNumber(value) !== null;
    case "url":
      try {
        const parsed = new URL(value.trim());
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    case "uuid":
      return UUID_PATTERN.test(value.trim());
  }
}

function parseIsoDate(value: string) {
  const normalized = value.trim();

  if (!ISO_DATE_PATTERN.test(normalized)) {
    return null;
  }

  const parsed = Date.parse(`${normalized}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed) ||
    new Date(parsed).toISOString().slice(0, 10) !== normalized
  ) {
    return null;
  }

  return parsed;
}

function parseFiniteNumber(value: string) {
  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function unableResult(
  contract: EvaluationContract,
  sample: ParsedCsvSample,
  reason: UnableToScoreReason,
  recordsEvaluated: number,
  coverageRatio: number,
  metric?: Metric,
): EvaluationResult {
  return {
    evidence: evidenceFor(
      contract,
      sample,
      recordsEvaluated,
      coverageRatio,
      metric,
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
  metric?: Metric,
): ResultEvidence {
  return {
    agreement: {
      ratio: null,
      requiredRatio: null,
      status: "not_applicable",
    },
    contractVersion: contract.contractVersion,
    controlCheck: "not_applicable",
    coverageRatio: roundRatio(coverageRatio),
    limitation:
      sample.rowCount === 1
        ? ONE_RECORD_LIMITATION
        : SUBMITTED_DATA_LIMITATION,
    measurement: metric
      ? {
          name: metric.measurementName,
          unit: "percent",
          value: roundPercentage(metric.percentage),
        }
      : null,
    method: "deterministic",
    recordsEvaluated,
    recordsSubmitted: sample.rowCount,
    zeroG: null,
  };
}

function percentageToScore(value: number) {
  const score = Math.max(1, Math.min(100, Math.round(value)));

  if (!isValidScore(score)) {
    throw new Error("Deterministic scoring produced an invalid score.");
  }

  return score;
}

function percentage(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : (numerator / denominator) * 100;
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function roundPercentage(value: number) {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

function canonical(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function isPresent(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function columnIndex(columns: string[]) {
  return new Map(
    columns.map((column, index) => [canonical(column), index]),
  );
}
