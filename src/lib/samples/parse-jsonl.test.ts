import { describe, expect, it } from "vitest";

import { PRODUCT_LIMITS } from "../product-contract";
import { parseJsonlSample } from "./parse-jsonl";
import { SampleError } from "./types";

const encode = (value: string) => new TextEncoder().encode(value);

describe("parseJsonlSample", () => {
  it("normalizes scalar, missing, null, and nested values", () => {
    const sample = parseJsonlSample(
      encode(
        [
          '{"id":9007199254740993123,"active":true,"meta":{"z":2,"a":1}}',
          '{"active":false,"id":2.370,"tags":["a","b"],"meta":null}',
        ].join("\n"),
      ),
    );

    expect(sample).toEqual({
      columnCount: 4,
      columns: ["id", "active", "meta", "tags"],
      format: "jsonl",
      rowCount: 2,
      rows: [
        ["9007199254740993123", "true", '{"a":1,"z":2}', ""],
        ["2.370", "false", "", '["a","b"]'],
      ],
    });
  });

  it("accepts BOM, blank lines, and first-seen column order", () => {
    const sample = parseJsonlSample(
      encode('\uFEFF{"b":"one"}\n\n{"a":"two","b":"three"}\n'),
    );

    expect(sample.columns).toEqual(["b", "a"]);
    expect(sample.rows).toEqual([
      ["one", ""],
      ["three", "two"],
    ]);
  });

  it("rejects malformed, non-object, duplicate, empty, and ambiguous keys", () => {
    for (const jsonl of [
      "",
      "[]",
      "true",
      '{"id":1',
      '{"id":1,"id":2}',
      '{"ID":1}\n{"id":2}',
      '{" ":1}',
    ]) {
      expect(() => parseJsonlSample(encode(jsonl))).toThrowError(
        SampleError,
      );
    }
  });

  it("enforces raw byte, record, column, and normalized limits", () => {
    expect(() =>
      parseJsonlSample(
        new Uint8Array(PRODUCT_LIMITS.maximumFileBytes + 1),
      ),
    ).toThrow("must not exceed");

    const tooManyRows = Array.from(
      { length: PRODUCT_LIMITS.maximumRows + 1 },
      (_, index) => JSON.stringify({ id: index }),
    ).join("\n");
    expect(() => parseJsonlSample(encode(tooManyRows))).toThrow(
      "data records",
    );

    const tooManyColumns = Object.fromEntries(
      Array.from(
        { length: PRODUCT_LIMITS.maximumColumns + 1 },
        (_, index) => [`column_${index}`, index],
      ),
    );
    expect(() =>
      parseJsonlSample(encode(JSON.stringify(tooManyColumns))),
    ).toThrow("columns");

  });

  it("rejects invalid UTF-8 and null bytes", () => {
    expect(() =>
      parseJsonlSample(Uint8Array.from([0xff, 0xfe, 0xfd])),
    ).toThrowError(SampleError);
    expect(() =>
      parseJsonlSample(encode('{"value":"\\u0000"}')),
    ).toThrowError(SampleError);
    expect(() =>
      parseJsonlSample(encode('{"value":"x"}\0')),
    ).toThrowError(SampleError);
  });
});
