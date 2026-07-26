import { describe, expect, it } from "vitest";

import {
  parseSemanticClassificationOutput,
  SemanticOutputError,
} from "./semantic-output";

describe("parseSemanticClassificationOutput", () => {
  const validOutput = {
    classifications: [
      { label: "positive", recordId: "record_001" },
    ],
    controls: [{ controlId: "control_a", label: "negative" }],
  };

  it("distinguishes empty, invalid JSON, and invalid shape", () => {
    for (const [content, code] of [
      ["", "empty_output"],
      ["```json\n{}\n```", "invalid_json"],
      ["{}", "invalid_shape"],
    ] as const) {
      try {
        parseSemanticClassificationOutput(
          content,
          ["record_001"],
          ["control_a"],
        );
        throw new Error("Expected semantic parsing to fail.");
      } catch (error) {
        expect(error).toBeInstanceOf(SemanticOutputError);
        expect((error as SemanticOutputError).code).toBe(code);
      }
    }
  });

  it("rejects valid JSON wrapped in Markdown fences", () => {
    expect(() =>
      parseSemanticClassificationOutput(
        `\`\`\`json\n${JSON.stringify(validOutput)}\n\`\`\``,
        ["record_001"],
        ["control_a"],
      ),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_json" }),
    );
  });

  it("accepts classifications only and rejects extra keys", () => {
    expect(
      parseSemanticClassificationOutput(
        JSON.stringify(validOutput),
        ["record_001"],
        ["control_a"],
      ),
    ).toEqual(validOutput);

    for (const output of [
      { ...validOutput, score: 100 },
      {
        ...validOutput,
        classifications: [
          {
            label: "positive",
            recordId: "record_001",
            score: 100,
          },
        ],
      },
    ]) {
      expect(() =>
        parseSemanticClassificationOutput(
          JSON.stringify(output),
          ["record_001"],
          ["control_a"],
        ),
      ).toThrowError(SemanticOutputError);
    }
  });

  it("rejects missing, duplicate, extra, and unknown classifications", () => {
    for (const classifications of [
      [],
      [
        { label: "positive", recordId: "record_001" },
        { label: "positive", recordId: "record_001" },
      ],
      [{ label: "perfect", recordId: "record_001" }],
      [{ label: "positive", recordId: "not_expected" }],
    ]) {
      expect(() =>
        parseSemanticClassificationOutput(
          JSON.stringify({
            classifications,
            controls: [
              { controlId: "control_a", label: "negative" },
            ],
          }),
          ["record_001"],
          ["control_a"],
        ),
      ).toThrowError(SemanticOutputError);
    }
  });
});
