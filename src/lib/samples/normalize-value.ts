import {
  isLosslessNumber,
  stringify as stringifyLossless,
} from "lossless-json";

import { SampleError } from "./types";

export function normalizeSampleValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    if (value.includes("\0")) {
      throw unsupportedValue();
    }

    return value;
  }

  if (typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw unsupportedValue();
    }

    return String(value);
  }

  if (isLosslessNumber(value)) {
    return value.toString();
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw unsupportedValue();
    }

    return value.toISOString();
  }

  if (Array.isArray(value) || isPlainRecord(value)) {
    const serialized = stringifyLossless(canonicalJsonValue(value));

    if (serialized === undefined) {
      throw unsupportedValue();
    }

    return serialized;
  }

  throw unsupportedValue();
}

function canonicalJsonValue(value: unknown): unknown {
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
    return value.map(canonicalJsonValue);
  }

  if (isPlainRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJsonValue(value[key])]),
    );
  }

  throw unsupportedValue();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function unsupportedValue() {
  return new SampleError(
    "The sample contains a value that cannot be represented safely.",
    "invalid_jsonl",
  );
}
