import { describe, expect, it } from "vitest";

import { parseCsvSample } from "../csv/parse-sample";
import {
  buildEvaluationFunctionTool,
  buildEvaluationMessages,
  EVALUATION_TOOL_NAME,
} from "./evaluation-prompt";

const QUESTIONS = [
  { id: "complete", question: "Are all required fields present?" },
  { id: "relevant", question: "Is each description relevant?" },
];
const SAMPLE = parseCsvSample(
  new TextEncoder().encode(
    ["id,description", "1,First", "2,Second"].join("\n"),
  ),
);

describe("evaluation prompt contract", () => {
  it("binds the forced tool schema to the exact evaluation and questions", () => {
    const tool = buildEvaluationFunctionTool({
      evaluationId: "evaluation-1",
      questions: QUESTIONS,
      rowCount: SAMPLE.rowCount,
    });
    const parameters = tool.parameters as {
      properties: {
        evaluation_id: { enum: string[] };
        results: {
          items: {
            properties: {
              evidence: {
                properties: {
                  row_numbers: {
                    items: { maximum: number };
                    uniqueItems: boolean;
                  };
                };
              };
              question_id: { enum: string[] };
              status: { enum: string[] };
            };
          };
          maxItems: number;
          minItems: number;
        };
      };
    };

    expect(tool.name).toBe(EVALUATION_TOOL_NAME);
    expect(parameters.properties.evaluation_id.enum).toEqual([
      "evaluation-1",
    ]);
    expect(parameters.properties.results.minItems).toBe(2);
    expect(parameters.properties.results.maxItems).toBe(2);
    expect(
      parameters.properties.results.items.properties.question_id.enum,
    ).toEqual(["complete", "relevant"]);
    expect(
      parameters.properties.results.items.properties.status.enum,
    ).toEqual(["scored", "unable"]);
    expect(
      parameters.properties.results.items.properties.evidence.properties
        .row_numbers,
    ).toMatchObject({ items: { maximum: 2 }, uniqueItems: true });
  });

  it("tells the model the exact tool, order, count, and status literals", () => {
    const messages = buildEvaluationMessages({
      evaluationId: "evaluation-1",
      questions: QUESTIONS,
      sample: SAMPLE,
    });
    const userPayload = JSON.parse(messages[1].content) as {
      required_output: {
        evaluation_id: string;
        question_ids_in_order: string[];
        result_count: number;
        status_values: string[];
        tool_name: string;
      };
    };

    expect(messages[0].content).toContain(EVALUATION_TOOL_NAME);
    expect(messages[0].content).toContain(
      "count failing units against the numerator",
    );
    expect(messages[0].content).toContain(
      "Do not use unable merely because",
    );
    expect(messages[0].content).toContain(
      "judge every applicable record",
    );
    expect(messages[0].content).toContain(
      "blank or malformed values remain in the denominator",
    );
    expect(messages[0].content).toContain(
      "choose the simplest conservative interpretation",
    );
    expect(userPayload.required_output).toEqual({
      evaluation_id: "evaluation-1",
      question_ids_in_order: ["complete", "relevant"],
      result_count: 2,
      status_values: ["scored", "unable"],
      tool_name: EVALUATION_TOOL_NAME,
    });
  });
});
