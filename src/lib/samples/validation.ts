import { PRODUCT_LIMITS } from "../product-contract";
import { SampleError } from "./types";

export function decodeUtf8(
  bytes: Uint8Array,
  formatLabel: string,
): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SampleError(
      `The ${formatLabel} sample must use valid UTF-8 encoding.`,
      "invalid_encoding",
    );
  }
}

export function assertRawSampleSize(
  bytes: Uint8Array,
  formatLabel: string,
) {
  if (bytes.byteLength === 0) {
    throw new SampleError(
      `The ${formatLabel} sample is empty.`,
      "empty_sample",
    );
  }

  if (bytes.byteLength > PRODUCT_LIMITS.maximumFileBytes) {
    throw new SampleError(
      `The ${formatLabel} sample must not exceed ${PRODUCT_LIMITS.maximumFileBytes} bytes.`,
      "sample_too_large",
    );
  }
}

export function assertColumns(
  columns: string[],
  invalidCode: "invalid_csv" | "invalid_jsonl" | "invalid_parquet",
) {
  if (
    columns.length < 1 ||
    columns.length > PRODUCT_LIMITS.maximumColumns
  ) {
    throw new SampleError(
      `The sample must contain 1–${PRODUCT_LIMITS.maximumColumns} columns.`,
      "too_many_columns",
    );
  }

  if (columns.some((column) => column.length === 0)) {
    throw new SampleError(
      "Every sample column must have a non-empty name.",
      invalidCode,
    );
  }

  const canonicalHeaders = columns.map((column) =>
    column.toLocaleLowerCase("en-US"),
  );

  if (new Set(canonicalHeaders).size !== canonicalHeaders.length) {
    throw new SampleError(
      "Sample column names must be unique.",
      invalidCode,
    );
  }
}

export function assertRows(
  rows: string[][],
  columnCount: number,
  invalidCode: "invalid_csv" | "invalid_jsonl" | "invalid_parquet",
) {
  if (rows.length < 1) {
    throw new SampleError(
      "The sample must contain at least one data record.",
      "empty_sample",
    );
  }

  if (rows.length > PRODUCT_LIMITS.maximumRows) {
    throw new SampleError(
      `The sample must not exceed ${PRODUCT_LIMITS.maximumRows} data records.`,
      "too_many_rows",
    );
  }

  if (rows.some((row) => row.length !== columnCount)) {
    throw new SampleError(
      "Every sample record must match the detected columns.",
      invalidCode,
    );
  }
}

export function assertNormalizedSize(
  columns: string[],
  rows: string[][],
) {
  const encoder = new TextEncoder();
  let totalBytes = 0;

  for (const value of [...columns, ...rows.flat()]) {
    totalBytes += encoder.encode(value).byteLength;

    if (totalBytes > PRODUCT_LIMITS.maximumNormalizedBytes) {
      throw new SampleError(
        `The decoded sample must not exceed ${PRODUCT_LIMITS.maximumNormalizedBytes} bytes.`,
        "normalized_sample_too_large",
      );
    }
  }
}
