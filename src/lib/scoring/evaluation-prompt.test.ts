import { describe, expect, it } from "vitest";

import { parseCsvSample } from "../csv/parse-sample";
import {
  buildEvaluationFunctionTool,
  buildEvaluationMessages,
  EVALUATION_TOOL_NAME,
  requiresScoredResult,
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
      columns: SAMPLE.columns,
      evaluationId: "evaluation-1",
      questions: QUESTIONS,
      rowCount: SAMPLE.rowCount,
    });
    const parameters = tool.parameters as {
      properties: {
        evaluation_id: { enum: string[] };
        results: {
          items: {
            oneOf: Array<{
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
                unit_judgments: {
                  items: { type: string };
                  minItems: number;
                };
              };
            }>;
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
    const resultSchemas =
      parameters.properties.results.items.oneOf;

    expect(
      resultSchemas.map(
        (schema) => schema.properties.question_id.enum[0],
      ),
    ).toEqual(["complete", "relevant"]);
    expect(
      resultSchemas[0].properties.status.enum,
    ).toEqual(["scored", "unable"]);
    expect(resultSchemas[1].properties.status.enum).toEqual([
      "scored",
    ]);
    expect(
      resultSchemas[1].properties.unit_judgments,
    ).toMatchObject({
      items: { type: "boolean" },
      minItems: 1,
    });
    expect(
      resultSchemas[1].properties.evidence.properties.row_numbers,
    ).toMatchObject({ items: { maximum: 2 }, uniqueItems: true });
  });

  it("requires scores only for aggregate questions tied to real columns", () => {
    expect(
      requiresScoredResult(
        {
          id: "quantity",
          question:
            "What percentage of quantity values are numeric and non-negative?",
        },
        ["sku", "quantity"],
      ),
    ).toBe(true);
    expect(
      requiresScoredResult(
        {
          id: "context",
          question:
            "What percentage of market_context values identify a Bitcoin-specific driver?",
        },
        ["market_context"],
      ),
    ).toBe(true);
    expect(
      requiresScoredResult(
        {
          id: "missing",
          question:
            "What percentage of customer_age values are plausible?",
        },
        ["sku", "quantity"],
      ),
    ).toBe(false);
    expect(
      requiresScoredResult(
        {
          id: "ambiguous",
          question: "Is this dataset useful?",
        },
        ["sku", "quantity"],
      ),
    ).toBe(false);
  });

  it("uses one globally scored schema when every question is answerable", () => {
    const questions = [
      {
        id: "complete",
        question:
          "What percentage of id values are non-empty?",
      },
      {
        id: "relevant",
        question: "Is each description relevant?",
      },
    ];
    const tool = buildEvaluationFunctionTool({
      columns: SAMPLE.columns,
      evaluationId: "evaluation-2",
      questions,
      rowCount: SAMPLE.rowCount,
    });
    const parameters = tool.parameters as {
      properties: {
        results: {
          items: {
            properties: {
              denominator: { minimum: number; type: string };
              numerator: { minimum: number; type: string };
              question_id: { enum: string[] };
              score: {
                maximum: number;
                minimum: number;
                type: string;
              };
              status: { enum: string[] };
              unit_judgments: {
                items: { type: string };
                minItems: number;
              };
            };
          };
        };
      };
    };
    const resultSchema = parameters.properties.results.items;

    expect(resultSchema.properties.question_id.enum).toEqual([
      "complete",
      "relevant",
    ]);
    expect(resultSchema.properties.status.enum).toEqual(["scored"]);
    expect(resultSchema.properties.score).toEqual({
      maximum: 100,
      minimum: 0,
      type: "integer",
    });
    expect(resultSchema.properties.numerator).toEqual({
      minimum: 0,
      type: "integer",
    });
    expect(resultSchema.properties.denominator).toEqual({
      minimum: 1,
      type: "integer",
    });
    expect(resultSchema.properties.unit_judgments).toMatchObject({
      items: { type: "boolean" },
      minItems: 1,
    });

    const messages = buildEvaluationMessages({
      evaluationId: "evaluation-2",
      questions,
      sample: SAMPLE,
    });
    const userPayload = JSON.parse(messages[1].content) as {
      required_output: { status_values: string[] };
    };

    expect(userPayload.required_output.status_values).toEqual([
      "scored",
    ]);
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
    expect(messages[0].content).toContain(
      "unit_judgments is the authoritative source",
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
