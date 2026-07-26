import { PRODUCT_LIMITS } from "../product-contract";

export const MAXIMUM_INFERENCE_REQUESTS_PER_EVALUATION =
  PRODUCT_LIMITS.maximumSemanticCriteria * 2;

export class InferenceRequestBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InferenceRequestBudgetError";
  }
}

export class InferenceRequestBudget {
  private consumedRequests = 0;

  constructor(readonly maximumRequests: number) {
    if (
      !Number.isSafeInteger(maximumRequests) ||
      maximumRequests < 0 ||
      maximumRequests > MAXIMUM_INFERENCE_REQUESTS_PER_EVALUATION
    ) {
      throw new InferenceRequestBudgetError(
        `The inference request limit must be between 0 and ${MAXIMUM_INFERENCE_REQUESTS_PER_EVALUATION}.`,
      );
    }
  }

  assertCanPlan(requests: number) {
    if (
      !Number.isSafeInteger(requests) ||
      requests < 0 ||
      this.consumedRequests + requests > this.maximumRequests
    ) {
      throw new InferenceRequestBudgetError(
        "The evaluation exceeds its private inference request budget.",
      );
    }
  }

  consume() {
    this.assertCanPlan(1);
    this.consumedRequests += 1;
  }

  snapshot() {
    return {
      made: this.consumedRequests,
      maximum: this.maximumRequests,
    };
  }
}

export function getInferenceRequestLimit(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const configured =
    environment.ZERO_G_MAX_REQUESTS_PER_EVALUATION?.trim();

  if (!configured) {
    return MAXIMUM_INFERENCE_REQUESTS_PER_EVALUATION;
  }

  if (!/^\d+$/.test(configured)) {
    throw new InferenceRequestBudgetError(
      "ZERO_G_MAX_REQUESTS_PER_EVALUATION must be a whole number.",
    );
  }

  const value = Number(configured);
  new InferenceRequestBudget(value);

  return value;
}
