import { parse as parseLossless } from "lossless-json";

import { PRODUCT_LIMITS } from "../product-contract";
import { normalizeSampleValue } from "./normalize-value";
import { SampleError, type ParsedSample } from "./types";
import {
  assertColumns,
  assertNormalizedSize,
  assertRawSampleSize,
  assertRows,
  decodeUtf8,
} from "./validation";

export function parseJsonlSample(bytes: Uint8Array): ParsedSample {
  assertRawSampleSize(bytes, "JSONL");

  const text = decodeUtf8(bytes, "JSONL").replace(/^\uFEFF/, "");

  if (text.includes("\0")) {
    throw invalidJsonl();
  }

  const lines = text
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 1) {
    throw new SampleError(
      "The JSONL sample must contain at least one object.",
      "empty_sample",
    );
  }

  if (lines.length > PRODUCT_LIMITS.maximumRows) {
    throw new SampleError(
      `The sample must not exceed ${PRODUCT_LIMITS.maximumRows} data records.`,
      "too_many_rows",
    );
  }

  const records = lines.map(parseObject);
  const columns: string[] = [];
  const sourceKeys = new Map<string, string>();

  for (const record of records) {
    for (const key of Object.keys(record)) {
      const column = key.trim();
      const canonical = column.toLocaleLowerCase("en-US");
      const previous = sourceKeys.get(canonical);

      if (previous !== undefined && previous !== key) {
        throw invalidJsonl();
      }

      if (previous === undefined) {
        sourceKeys.set(canonical, key);
        columns.push(column);

        if (columns.length > PRODUCT_LIMITS.maximumColumns) {
          throw new SampleError(
            `The sample must contain 1–${PRODUCT_LIMITS.maximumColumns} columns.`,
            "too_many_columns",
          );
        }
      }
    }
  }

  assertColumns(columns, "invalid_jsonl");

  const rows = records.map((record) =>
    columns.map((column) => {
      const sourceKey = sourceKeys.get(
        column.toLocaleLowerCase("en-US"),
      );
      return normalizeSampleValue(
        sourceKey === undefined ? undefined : record[sourceKey],
      );
    }),
  );

  assertRows(rows, columns.length, "invalid_jsonl");
  assertNormalizedSize(columns, rows);

  return {
    columnCount: columns.length,
    columns,
    format: "jsonl",
    rowCount: rows.length,
    rows,
  };
}

function parseObject(line: string): Record<string, unknown> {
  let value: unknown;

  try {
    value = parseLossless(line);
  } catch {
    throw invalidJsonl();
  }

  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw invalidJsonl();
  }

  return value as Record<string, unknown>;
}

function invalidJsonl() {
  return new SampleError(
    "Every JSONL line must be one valid JSON object with unambiguous keys.",
    "invalid_jsonl",
  );
}
