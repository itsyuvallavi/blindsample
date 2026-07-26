import { parquetWriteBuffer } from "hyparquet-writer";
import { describe, expect, it } from "vitest";

import {
  parseSample,
  sampleFormatFromFileName,
} from "./parse-sample";
import { SampleError } from "./types";

const encode = (value: string) => new TextEncoder().encode(value);

describe("parseSample", () => {
  it("normalizes equivalent CSV, JSONL, and Parquet inputs", async () => {
    const parquet = new Uint8Array(
      parquetWriteBuffer({
        columnData: [
          { data: ["1", "2"], name: "id", type: "STRING" },
          {
            data: ["first", "second"],
            name: "value",
            type: "STRING",
          },
        ],
      }),
    );

    const samples = await Promise.all([
      parseSample({
        bytes: encode("id,value\n1,first\n2,second"),
        fileName: "sample.csv",
      }),
      parseSample({
        bytes: encode(
          '{"id":"1","value":"first"}\n{"id":"2","value":"second"}',
        ),
        fileName: "sample.jsonl",
      }),
      parseSample({
        bytes: parquet,
        fileName: "sample.parquet",
      }),
    ]);

    expect(
      samples.map(({ columns, rowCount, rows }) => ({
        columns,
        rowCount,
        rows,
      })),
    ).toEqual([
      {
        columns: ["id", "value"],
        rowCount: 2,
        rows: [
          ["1", "first"],
          ["2", "second"],
        ],
      },
      {
        columns: ["id", "value"],
        rowCount: 2,
        rows: [
          ["1", "first"],
          ["2", "second"],
        ],
      },
      {
        columns: ["id", "value"],
        rowCount: 2,
        rows: [
          ["1", "first"],
          ["2", "second"],
        ],
      },
    ]);
  });

  it("accepts case-insensitive JSONL and NDJSON extensions", () => {
    expect(sampleFormatFromFileName("sample.JSONL")).toBe("jsonl");
    expect(sampleFormatFromFileName("sample.ndjson")).toBe("jsonl");
  });

  it("rejects missing and unsupported extensions", async () => {
    for (const fileName of ["sample", "sample.json", "sample.xlsx"]) {
      await expect(
        parseSample({ bytes: encode("{}"), fileName }),
      ).rejects.toThrowError(SampleError);
    }
  });

  it("does not trust a parquet extension without parquet bytes", async () => {
    await expect(
      parseSample({
        bytes: encode('{"id":1}'),
        fileName: "renamed.parquet",
      }),
    ).rejects.toThrow("invalid file signature");
  });
});
