import { describe, expect, it } from "vitest";

import { PRODUCT_LIMITS } from "../product-contract";
import { CsvSampleError, parseCsvSample } from "./parse-sample";

const encode = (value: string) => new TextEncoder().encode(value);

describe("parseCsvSample", () => {
  it("parses quoted values and preserves cell meaning", () => {
    const sample = parseCsvSample(
      encode(
        [
          " customer ,notes,total",
          'Ada,"asked, then paid", 42.00 ',
          'Grace,"line one\nline two",18.50',
        ].join("\n"),
      ),
    );

    expect(sample).toEqual({
      columnCount: 3,
      columns: ["customer", "notes", "total"],
      rowCount: 2,
      rows: [
        ["Ada", "asked, then paid", " 42.00 "],
        ["Grace", "line one\nline two", "18.50"],
      ],
    });
  });

  it("accepts a UTF-8 BOM and rejects invalid UTF-8", () => {
    expect(
      parseCsvSample(encode("\uFEFFid,value\n1,yes")).columns,
    ).toEqual(["id", "value"]);
    expect(() =>
      parseCsvSample(Uint8Array.from([0xff, 0xfe, 0xfd])),
    ).toThrowError(CsvSampleError);
  });

  it("rejects missing, duplicate, and inconsistent headers", () => {
    for (const csv of [
      "id,\n1,value",
      "ID,id\n1,2",
      "id,value\n1",
      "id,value\n1,2,3",
    ]) {
      expect(() => parseCsvSample(encode(csv))).toThrowError(
        CsvSampleError,
      );
    }
  });

  it("requires a data row and valid CSV quoting", () => {
    expect(() => parseCsvSample(encode("id,value"))).toThrow(
      "at least one data row",
    );
    expect(() =>
      parseCsvSample(encode('id,value\n1,"unterminated')),
    ).toThrowError(CsvSampleError);
  });

  it("enforces byte, row, and column limits", () => {
    expect(() =>
      parseCsvSample(
        new Uint8Array(PRODUCT_LIMITS.maximumFileBytes + 1),
      ),
    ).toThrow("must not exceed");

    const tooManyRows = [
      "id",
      ...Array.from(
        { length: PRODUCT_LIMITS.maximumRows + 1 },
        (_, index) => String(index),
      ),
    ].join("\n");
    expect(() => parseCsvSample(encode(tooManyRows))).toThrow(
      "data rows",
    );

    const headers = Array.from(
      { length: PRODUCT_LIMITS.maximumColumns + 1 },
      (_, index) => `column_${index}`,
    );
    expect(() =>
      parseCsvSample(
        encode(`${headers.join(",")}\n${headers.map(() => "x").join(",")}`),
      ),
    ).toThrow("columns");
  });
});
