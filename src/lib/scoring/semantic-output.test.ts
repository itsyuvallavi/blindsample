import { describe, expect, it } from "vitest";

import {
  parseSemanticClassificationOutput,
  SemanticOutputError,
} from "./semantic-output";

describe("parseSemanticClassificationOutput", () => {
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

  it("accepts classifications only and rejects model-authored scores", () => {
    expect(
      parseSemanticClassificationOutput(
        JSON.stringify({
          classifications: [
            { label: "positive", recordId: "record_001" },
          ],
          controls: [
            { controlId: "control_a", label: "negative" },
          ],
        }),
        ["record_001"],
        ["control_a"],
      ),
    ).toEqual({
      classifications: [
        { label: "positive", recordId: "record_001" },
      ],
      controls: [{ controlId: "control_a", label: "negative" }],
    });

    expect(() =>
      parseSemanticClassificationOutput(
        JSON.stringify({
          classifications: [
            {
              label: "positive",
              recordId: "record_001",
              score: 100,
            },
          ],
          controls: [
            { controlId: "control_a", label: "negative" },
          ],
        }),
        ["record_001"],
        ["control_a"],
      ),
    ).toThrowError(SemanticOutputError);
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
