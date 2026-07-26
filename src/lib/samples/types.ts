export type SampleFormat = "csv" | "jsonl" | "parquet";

export type ParsedSample = {
  columns: string[];
  columnCount: number;
  format: SampleFormat;
  rowCount: number;
  rows: string[][];
};

export type SampleErrorCode =
  | "empty_sample"
  | "invalid_csv"
  | "invalid_encoding"
  | "sample_too_large"
  | "too_many_columns"
  | "too_many_rows";

export class SampleError extends Error {
  constructor(
    message: string,
    readonly code: SampleErrorCode,
  ) {
    super(message);
    this.name = "SampleError";
  }
}
