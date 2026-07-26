import { parquetWriteBuffer } from "hyparquet-writer";
import { describe, expect, it } from "vitest";

import { PRODUCT_LIMITS } from "../product-contract";
import { parseParquetSample } from "./parse-parquet";
import { SampleError } from "./types";

describe("parseParquetSample", () => {
  it("normalizes flat scalar values without losing integers or timestamps", async () => {
    const bytes = parquetBytes({
      columnData: [
        {
          data: [
            BigInt("9007199254740993123"),
            BigInt(2),
          ],
          name: "id",
          type: "INT64",
        },
        {
          data: [true, false],
          name: "active",
          type: "BOOLEAN",
        },
        {
          data: [
            new Date("2026-07-26T10:00:00.000Z"),
            new Date("2026-07-26T10:01:00.000Z"),
          ],
          name: "timestamp",
          type: "TIMESTAMP",
        },
        {
          data: [null, "second"],
          name: "label",
          nullable: true,
          type: "STRING",
        },
      ],
      rowGroupSize: 1,
    });

    await expect(parseParquetSample(bytes)).resolves.toEqual({
      columnCount: 4,
      columns: ["id", "active", "timestamp", "label"],
      format: "parquet",
      rowCount: 2,
      rows: [
        [
          "9007199254740993123",
          "true",
          "2026-07-26T10:00:00.000Z",
          "",
        ],
        ["2", "false", "2026-07-26T10:01:00.000Z", "second"],
      ],
    });
  });

  it("normalizes decimal logical values", async () => {
    const bytes = parquetBytes({
      columnData: [
        {
          data: [12.34, 0.01],
          name: "amount",
        },
      ],
      schema: [
        { name: "root", num_children: 1 },
        {
          converted_type: "DECIMAL",
          name: "amount",
          precision: 12,
          scale: 2,
          type: "FIXED_LEN_BYTE_ARRAY",
          type_length: 8,
        },
      ],
    });

    const sample = await parseParquetSample(bytes);

    expect(sample.rows).toEqual([["12.34"], ["0.01"]]);
  });

  it("reads every row group without truncation", async () => {
    const bytes = parquetBytes({
      columnData: [
        {
          data: ["one", "two", "three", "four", "five"],
          name: "value",
          type: "STRING",
        },
      ],
      rowGroupSize: 2,
    });

    const sample = await parseParquetSample(bytes);

    expect(sample.rowCount).toBe(5);
    expect(sample.rows).toEqual([
      ["one"],
      ["two"],
      ["three"],
      ["four"],
      ["five"],
    ]);
  });

  it("rejects malformed signatures and files", async () => {
    await expect(
      parseParquetSample(new TextEncoder().encode("not parquet")),
    ).rejects.toThrowError(SampleError);

    const bytes = parquetBytes({
      columnData: [
        { data: ["one"], name: "value", type: "STRING" },
      ],
    });
    bytes[0] = 0;

    await expect(parseParquetSample(bytes)).rejects.toThrow(
      "invalid file signature",
    );
  });

  it("rejects excessive rows and columns from metadata", async () => {
    const tooManyRows = parquetBytes({
      columnData: [
        {
          data: Array.from(
            { length: PRODUCT_LIMITS.maximumRows + 1 },
            (_, index) => index,
          ),
          name: "id",
          type: "INT32",
        },
      ],
    });
    await expect(parseParquetSample(tooManyRows)).rejects.toThrow(
      "data records",
    );

    const tooManyColumns = parquetBytes({
      columnData: Array.from(
        { length: PRODUCT_LIMITS.maximumColumns + 1 },
        (_, index) => ({
          data: [index],
          name: `column_${index}`,
          type: "INT32" as const,
        }),
      ),
    });
    await expect(parseParquetSample(tooManyColumns)).rejects.toThrow(
      "columns",
    );
  });

  it("rejects a compressed expansion at the normalized boundary", async () => {
    const bytes = parquetBytes({
      columnData: [
        {
          data: [
            "x".repeat(PRODUCT_LIMITS.maximumDecodedFileBytes + 1),
          ],
          name: "payload",
          type: "STRING",
        },
      ],
    });

    expect(bytes.byteLength).toBeLessThan(
      PRODUCT_LIMITS.maximumFileBytes,
    );
    await expect(parseParquetSample(bytes)).rejects.toThrow(
      "decoded sample",
    );
  });
});

function parquetBytes(
  options: Parameters<typeof parquetWriteBuffer>[0],
) {
  return new Uint8Array(parquetWriteBuffer(options));
}
