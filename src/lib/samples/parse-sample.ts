import { parseCsvSample } from "./parse-csv";
import { parseJsonlSample } from "./parse-jsonl";
import { parseParquetSample } from "./parse-parquet";
import {
  SampleError,
  type ParsedSample,
  type SampleFormat,
} from "./types";

export type SampleInput = {
  bytes: Uint8Array;
  fileName: string;
};

export async function parseSample(
  input: SampleInput,
): Promise<ParsedSample> {
  switch (sampleFormatFromFileName(input.fileName)) {
    case "csv":
      return parseCsvSample(input.bytes);
    case "jsonl":
      return parseJsonlSample(input.bytes);
    case "parquet":
      return parseParquetSample(input.bytes);
  }
}

export function sampleFormatFromFileName(
  fileName: string,
): SampleFormat {
  const extension = fileName
    .trim()
    .toLocaleLowerCase("en-US")
    .match(/\.([^.]+)$/u)?.[1];

  switch (extension) {
    case "csv":
      return "csv";
    case "jsonl":
    case "ndjson":
      return "jsonl";
    case "parquet":
      return "parquet";
    default:
      throw new SampleError(
        "Choose a CSV, JSONL, NDJSON, or Parquet sample.",
        "unsupported_format",
      );
  }
}
