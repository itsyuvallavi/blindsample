import {
  parquetMetadataAsync,
  parquetReadObjects,
  parquetSchema,
  type FileMetaData,
  type SchemaTree,
} from "hyparquet";

import { PRODUCT_LIMITS } from "../product-contract";
import { normalizeSampleValue } from "./normalize-value";
import { SampleError, type ParsedSample } from "./types";
import {
  assertColumns,
  assertNormalizedSize,
  assertRawSampleSize,
  assertRows,
} from "./validation";

const SUPPORTED_CODECS = new Set(["UNCOMPRESSED", "SNAPPY"]);

export async function parseParquetSample(
  bytes: Uint8Array,
): Promise<ParsedSample> {
  assertRawSampleSize(bytes, "Parquet");
  assertParquetMagic(bytes);

  const file = Uint8Array.from(bytes).buffer;
  let metadata: FileMetaData;

  try {
    metadata = await parquetMetadataAsync(file, {
      geoparquet: false,
    });
  } catch (error) {
    throw asParquetError(error);
  }

  assertMetadataLimits(metadata);

  let schema: SchemaTree;

  try {
    schema = parquetSchema(metadata);
  } catch (error) {
    throw asParquetError(error);
  }

  if (
    schema.children.some(
      (column) =>
        column.children.length > 0 ||
        column.element.repetition_type === "REPEATED",
    )
  ) {
    throw new SampleError(
      "The Parquet sample must use a flat, non-repeated schema.",
      "unsupported_parquet",
    );
  }

  const sourceColumns = schema.children.map(
    (column) => column.element.name,
  );
  const columns = sourceColumns.map((column) => column.trim());
  assertColumns(columns, "invalid_parquet");
  assertSupportedColumns(schema.children);

  let records: Record<string, unknown>[];

  try {
    records = await parquetReadObjects({
      file,
      geoparquet: false,
      metadata,
      utf8: true,
    });
  } catch (error) {
    throw asParquetError(error);
  }

  const rows = records.map((record) =>
    sourceColumns.map((column) =>
      normalizeSampleValue(record[column], "invalid_parquet"),
    ),
  );

  assertRows(rows, columns.length, "invalid_parquet");
  assertNormalizedSize(columns, rows);

  return {
    columnCount: columns.length,
    columns,
    format: "parquet",
    rowCount: rows.length,
    rows,
  };
}

function assertParquetMagic(bytes: Uint8Array) {
  if (
    bytes.byteLength < 8 ||
    !matchesMagic(bytes, 0) ||
    !matchesMagic(bytes, bytes.byteLength - 4)
  ) {
    throw new SampleError(
      "The Parquet sample has an invalid file signature.",
      "invalid_parquet",
    );
  }
}

function matchesMagic(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] === 0x50 &&
    bytes[offset + 1] === 0x41 &&
    bytes[offset + 2] === 0x52 &&
    bytes[offset + 3] === 0x31
  );
}

function assertMetadataLimits(metadata: FileMetaData) {
  if (metadata.num_rows < BigInt(1)) {
    throw new SampleError(
      "The Parquet sample must contain at least one data record.",
      "empty_sample",
    );
  }

  if (metadata.num_rows > BigInt(PRODUCT_LIMITS.maximumRows)) {
    throw new SampleError(
      `The sample must not exceed ${PRODUCT_LIMITS.maximumRows} data records.`,
      "too_many_rows",
    );
  }

  let decodedBytes = BigInt(0);

  for (const rowGroup of metadata.row_groups) {
    for (const column of rowGroup.columns) {
      const details = column.meta_data;

      if (
        column.crypto_metadata !== undefined ||
        column.encrypted_column_metadata !== undefined ||
        details === undefined
      ) {
        throw new SampleError(
          "Encrypted or incomplete Parquet columns are not supported.",
          "unsupported_parquet",
        );
      }

      if (!SUPPORTED_CODECS.has(details.codec)) {
        throw new SampleError(
          `Parquet compression ${details.codec} is not supported yet.`,
          "unsupported_parquet",
        );
      }

      decodedBytes += details.total_uncompressed_size;

      if (
        decodedBytes >
        BigInt(PRODUCT_LIMITS.maximumDecodedFileBytes)
      ) {
        throw new SampleError(
          `The decoded Parquet sample must not exceed ${PRODUCT_LIMITS.maximumDecodedFileBytes} bytes.`,
          "normalized_sample_too_large",
        );
      }
    }
  }
}

function assertSupportedColumns(columns: SchemaTree[]) {
  for (const column of columns) {
    const { converted_type: convertedType, logical_type: logicalType } =
      column.element;
    const type = column.element.type;

    if (
      type === "BOOLEAN" ||
      type === "INT32" ||
      type === "INT64" ||
      type === "INT96" ||
      type === "FLOAT" ||
      type === "DOUBLE"
    ) {
      continue;
    }

    if (
      type === "BYTE_ARRAY" &&
      (convertedType === "UTF8" ||
        convertedType === "JSON" ||
        convertedType === "ENUM" ||
        logicalType?.type === "STRING" ||
        logicalType?.type === "JSON" ||
        logicalType?.type === "ENUM")
    ) {
      continue;
    }

    if (
      type === "FIXED_LEN_BYTE_ARRAY" &&
      (convertedType === "DECIMAL" ||
        logicalType?.type === "DECIMAL" ||
        logicalType?.type === "UUID")
    ) {
      continue;
    }

    throw new SampleError(
      `Parquet column ${column.element.name} uses an unsupported type.`,
      "unsupported_parquet",
    );
  }
}

function asParquetError(error: unknown) {
  if (error instanceof SampleError) {
    return error;
  }

  return new SampleError(
    "The Parquet sample is malformed or unsupported.",
    "invalid_parquet",
  );
}
