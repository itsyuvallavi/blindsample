import {
  compileEvaluationContracts,
  EvaluationContractError,
} from "../evaluation-contracts/compile";
import { hashEvaluationContracts } from "../evaluation-contracts/hash";
import type {
  CriterionDraft,
  EvaluationContractPreview,
} from "../evaluation-contracts/types";
import { PRODUCT_LIMITS } from "../product-contract";
import type { CreateEvaluationInput } from "../supabase/evaluations";

const HASH_PATTERN = /^[0-9a-f]{64}$/;

export type ValidatedEvaluationDraft = CreateEvaluationInput;

export class EvaluationInputError extends Error {
  constructor(
    message: string,
    readonly code:
      | "approval_mismatch"
      | "clarification_required"
      | "invalid_contract"
      | "invalid_evaluation"
      | "invalid_title"
      | "semantic_criterion_required",
  ) {
    super(message);
    this.name = "EvaluationInputError";
  }
}

export function validateContractPreviewDraft(
  value: unknown,
): EvaluationContractPreview {
  if (!isRecord(value) || !hasExactKeys(value, ["criteria"])) {
    throw new EvaluationInputError(
      "Contract preview input must contain only criteria.",
      "invalid_evaluation",
    );
  }

  const contracts = compileCriteria(value.criteria);

  return {
    contracts,
    contractSetHash: hashEvaluationContracts(contracts),
  };
}

export function validateEvaluationDraft(
  value: unknown,
): ValidatedEvaluationDraft {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "approvedContractSetHash",
      "criteria",
      "title",
    ])
  ) {
    throw new EvaluationInputError(
      "Evaluation input must contain only a title, criteria, and the approved contract-set hash.",
      "invalid_evaluation",
    );
  }

  if (
    typeof value.approvedContractSetHash !== "string" ||
    !HASH_PATTERN.test(value.approvedContractSetHash)
  ) {
    throw new EvaluationInputError(
      "Approve the reviewed evaluation contracts before activation.",
      "approval_mismatch",
    );
  }

  const contracts = compileCriteria(value.criteria);
  const contractSetHash = hashEvaluationContracts(contracts);

  if (contractSetHash !== value.approvedContractSetHash) {
    throw new EvaluationInputError(
      "The criteria changed after contract review. Review and approve the updated contracts.",
      "approval_mismatch",
    );
  }

  return {
    contracts,
    contractSetHash,
    title: validateTitle(value.title),
  };
}

function compileCriteria(value: unknown) {
  try {
    return compileEvaluationContracts(value as CriterionDraft[]);
  } catch (error) {
    if (error instanceof EvaluationContractError) {
      throw new EvaluationInputError(error.message, error.code);
    }

    throw error;
  }
}

function validateTitle(value: unknown) {
  if (typeof value !== "string") {
    throw new EvaluationInputError(
      "Evaluation title must be text.",
      "invalid_title",
    );
  }

  const title = value.trim();

  if (
    title.length < 1 ||
    title.length > PRODUCT_LIMITS.maximumTitleCharacters
  ) {
    throw new EvaluationInputError(
      `Evaluation title must contain 1–${PRODUCT_LIMITS.maximumTitleCharacters} characters.`,
      "invalid_title",
    );
  }

  return title;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: string[],
) {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every(
      (key, index) => key === sortedExpectedKeys[index],
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
