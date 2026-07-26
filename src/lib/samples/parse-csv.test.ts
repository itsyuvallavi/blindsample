import { describe, expect, it } from "vitest";

import { PRODUCT_LIMITS } from "../product-contract";
import { parseCsvSample } from "./parse-csv";
import { SampleError } from "./types";

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
      format: "csv",
      rowCount: 2,
      rows: [
        ["Ada", "asked, then paid", " 42.00 "],
        ["Grace", "line one\nline two", "18.50"],
      ],
    });
  });

  it("accepts exactly one parsed data record", () => {
    const sample = parseCsvSample(encode("id,value\n1,kept"));

    expect(sample.rowCount).toBe(1);
    expect(sample.rows).toEqual([["1", "kept"]]);
  });

  it("accepts 50 parsed data records without truncation", () => {
    const expectedRows = Array.from({ length: 50 }, (_, index) => [
      String(index + 1),
      `value-${index + 1}`,
    ]);
    const csv = [
      "id,value",
      ...expectedRows.map((row) => row.join(",")),
    ].join("\n");

    const sample = parseCsvSample(encode(csv));

    expect(sample.rowCount).toBe(50);
    expect(sample.rows).toEqual(expectedRows);
    expect(sample.rows.at(-1)).toEqual(["50", "value-50"]);
  });

  it("rejects 51 parsed data records", () => {
    const csv = [
      "id",
      ...Array.from({ length: 51 }, (_, index) => String(index + 1)),
    ].join("\n");

    expect(() => parseCsvSample(encode(csv))).toThrow(
      "must not exceed 50 data rows",
    );
  });

  it("excludes the header and counts quoted newlines as one record", () => {
    const csv = [
      "id,notes",
      '1,"line one',
      'line two"',
      '2,"single line"',
    ].join("\n");

    const sample = parseCsvSample(encode(csv));

    expect(sample.rowCount).toBe(2);
    expect(sample.rows).toEqual([
      ["1", "line one\nline two"],
      ["2", "single line"],
    ]);
  });

  it("accepts a UTF-8 BOM and rejects invalid UTF-8", () => {
    expect(
      parseCsvSample(encode("\uFEFFid,value\n1,yes")).columns,
    ).toEqual(["id", "value"]);
    expect(() =>
      parseCsvSample(Uint8Array.from([0xff, 0xfe, 0xfd])),
    ).toThrowError(SampleError);
  });

  it("rejects missing, duplicate, and inconsistent headers", () => {
    for (const csv of [
      "id,\n1,value",
      "ID,id\n1,2",
      "id,value\n1",
      "id,value\n1,2,3",
    ]) {
      expect(() => parseCsvSample(encode(csv))).toThrowError(
        SampleError,
      );
    }
  });

  it("rejects zero data records and invalid CSV quoting", () => {
    expect(() => parseCsvSample(encode("id,value"))).toThrow(
      "at least one data row",
    );
    expect(() =>
      parseCsvSample(encode('id,value\n1,"unterminated')),
    ).toThrowError(SampleError);
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
