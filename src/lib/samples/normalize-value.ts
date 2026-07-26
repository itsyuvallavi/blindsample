import {
  isLosslessNumber,
  stringify as stringifyLossless,
} from "lossless-json";

import {
  SampleError,
  type SampleErrorCode,
} from "./types";

export function normalizeSampleValue(
  value: unknown,
  invalidCode: Extract<
    SampleErrorCode,
    "invalid_jsonl" | "invalid_parquet"
  > = "invalid_jsonl",
): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    if (value.includes("\0")) {
      throw unsupportedValue(invalidCode);
    }

    return value;
  }

  if (typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw unsupportedValue(invalidCode);
    }

    return String(value);
  }

  if (isLosslessNumber(value)) {
    return value.toString();
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw unsupportedValue(invalidCode);
    }

    return value.toISOString();
  }

  if (Array.isArray(value) || isPlainRecord(value)) {
    const serialized = stringifyLossless(
      canonicalJsonValue(value, invalidCode),
    );

    if (serialized === undefined) {
      throw unsupportedValue(invalidCode);
    }

    return serialized;
  }

  throw unsupportedValue(invalidCode);
}

function canonicalJsonValue(
  value: unknown,
  invalidCode: Extract<
    SampleErrorCode,
    "invalid_jsonl" | "invalid_parquet"
  >,
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "number" ||
    isLosslessNumber(value)
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      canonicalJsonValue(item, invalidCode),
    );
  }

  if (isPlainRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonicalJsonValue(value[key], invalidCode),
        ]),
    );
  }

  throw unsupportedValue(invalidCode);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function unsupportedValue(
  code: Extract<
    SampleErrorCode,
    "invalid_jsonl" | "invalid_parquet"
  >,
) {
  return new SampleError(
    "The sample contains a value that cannot be represented safely.",
    code,
  );
}
