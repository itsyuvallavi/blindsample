import { parse } from "csv-parse/sync";

import { PRODUCT_LIMITS } from "../product-contract";
import { SampleError, type ParsedSample } from "./types";

export function parseCsvSample(bytes: Uint8Array): ParsedSample {
  if (bytes.byteLength === 0) {
    throw new SampleError(
      "The CSV sample is empty.",
      "empty_sample",
    );
  }

  if (bytes.byteLength > PRODUCT_LIMITS.maximumFileBytes) {
    throw new SampleError(
      `The CSV sample must not exceed ${PRODUCT_LIMITS.maximumFileBytes} bytes.`,
      "sample_too_large",
    );
  }

  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SampleError(
      "The CSV sample must use valid UTF-8 encoding.",
      "invalid_encoding",
    );
  }

  if (text.includes("\0")) {
    throw new SampleError(
      "The CSV sample contains unsupported null bytes.",
      "invalid_csv",
    );
  }

  let records: string[][];

  try {
    records = parse(text, {
      bom: true,
      columns: false,
      max_record_size: PRODUCT_LIMITS.maximumFileBytes,
      relax_column_count: false,
      relax_quotes: false,
      skip_empty_lines: true,
    }) as string[][];
  } catch {
    throw new SampleError(
      "The CSV sample is malformed or has inconsistent columns.",
      "invalid_csv",
    );
  }

  if (records.length < 2) {
    throw new SampleError(
      "The CSV sample needs one header row and at least one data row.",
      "empty_sample",
    );
  }

  const columns = records[0].map((column) => column.trim());

  if (
    columns.length < 1 ||
    columns.length > PRODUCT_LIMITS.maximumColumns
  ) {
    throw new SampleError(
      `The CSV sample must contain 1–${PRODUCT_LIMITS.maximumColumns} columns.`,
      "too_many_columns",
    );
  }

  if (columns.some((column) => column.length === 0)) {
    throw new SampleError(
      "Every CSV column must have a non-empty header.",
      "invalid_csv",
    );
  }

  const canonicalHeaders = columns.map((column) =>
    column.toLocaleLowerCase("en-US"),
  );

  if (new Set(canonicalHeaders).size !== canonicalHeaders.length) {
    throw new SampleError(
      "CSV headers must be unique.",
      "invalid_csv",
    );
  }

  const rows = records.slice(1);

  if (rows.length > PRODUCT_LIMITS.maximumRows) {
    throw new SampleError(
      `The CSV sample must not exceed ${PRODUCT_LIMITS.maximumRows} data rows.`,
      "too_many_rows",
    );
  }

  if (rows.some((row) => row.length !== columns.length)) {
    throw new SampleError(
      "Every CSV row must contain the same number of columns.",
      "invalid_csv",
    );
  }

  return {
    columnCount: columns.length,
    columns,
    format: "csv",
    rowCount: rows.length,
    rows,
  };
}
