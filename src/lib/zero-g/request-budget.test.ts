import { describe, expect, it } from "vitest";

import {
  getInferenceRequestLimit,
  InferenceRequestBudget,
  InferenceRequestBudgetError,
  MAXIMUM_INFERENCE_REQUESTS_PER_EVALUATION,
} from "./request-budget";

describe("InferenceRequestBudget", () => {
  it("counts each attempted request and blocks before exceeding the limit", () => {
    const budget = new InferenceRequestBudget(2);

    budget.assertCanPlan(2);
    budget.consume();
    budget.consume();

    expect(budget.snapshot()).toEqual({ made: 2, maximum: 2 });
    expect(() => budget.consume()).toThrowError(
      InferenceRequestBudgetError,
    );
  });

  it("rejects an over-budget plan before consuming any request", () => {
    const budget = new InferenceRequestBudget(1);

    expect(() => budget.assertCanPlan(2)).toThrowError(
      "exceeds its private inference request budget",
    );
    expect(budget.snapshot()).toEqual({ made: 0, maximum: 1 });
  });
});

describe("getInferenceRequestLimit", () => {
  it("defaults to the product maximum and accepts a lower hard limit", () => {
    expect(getInferenceRequestLimit({})).toBe(
      MAXIMUM_INFERENCE_REQUESTS_PER_EVALUATION,
    );
    expect(
      getInferenceRequestLimit({
        ZERO_G_MAX_REQUESTS_PER_EVALUATION: "2",
      }),
    ).toBe(2);
  });

  it("rejects malformed or excessive limits", () => {
    for (const configured of [
      "-1",
      "1.5",
      String(MAXIMUM_INFERENCE_REQUESTS_PER_EVALUATION + 1),
    ]) {
      expect(() =>
        getInferenceRequestLimit({
          ZERO_G_MAX_REQUESTS_PER_EVALUATION: configured,
        }),
      ).toThrowError(InferenceRequestBudgetError);
    }
  });
});
