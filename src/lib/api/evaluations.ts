import { isCapabilityToken } from "../access/capabilities";
import {
  SampleSubmissionError,
  submitPrivateSample,
} from "../evaluations/submit";
import {
  EvaluationInputError,
  validateEvaluationDraft,
} from "../evaluations/validation";
import { PRODUCT_LIMITS } from "../product-contract";
import { SampleError } from "../samples/types";
import {
  createEvaluation,
  EvaluationRepositoryError,
  getBuyerEvaluation,
  getSellerEvaluation,
  type BuyerEvaluationView,
  type CreateEvaluationInput,
  type CreatedEvaluation,
  type SellerEvaluationView,
} from "../supabase/evaluations";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAXIMUM_CREATE_BODY_BYTES = 16_384;
const MAXIMUM_MULTIPART_BODY_BYTES =
  PRODUCT_LIMITS.maximumFileBytes + 100_000;

type CreateDependencies = {
  create: (input: CreateEvaluationInput) => Promise<CreatedEvaluation>;
};

type ReadDependencies = {
  getBuyer: (
    id: string,
    token: string,
  ) => Promise<BuyerEvaluationView | null>;
  getSeller: (
    id: string,
    token: string,
  ) => Promise<SellerEvaluationView | null>;
};

type SubmitDependencies = {
  submit: (input: {
    bytes: Uint8Array;
    evaluationId: string;
    fileName: string;
    sellerToken: string;
  }) => Promise<{ status: "complete" }>;
};

const CREATE_DEPENDENCIES: CreateDependencies = {
  create: createEvaluation,
};

const READ_DEPENDENCIES: ReadDependencies = {
  getBuyer: getBuyerEvaluation,
  getSeller: getSellerEvaluation,
};

const SUBMIT_DEPENDENCIES: SubmitDependencies = {
  submit: submitPrivateSample,
};

export async function handleCreateEvaluation(
  request: Request,
  dependencies: CreateDependencies = CREATE_DEPENDENCIES,
) {
  if (declaredSizeExceeds(request, MAXIMUM_CREATE_BODY_BYTES)) {
    return apiError(
      413,
      "request_too_large",
      "The evaluation request is too large.",
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(
      400,
      "invalid_json",
      "Provide a valid JSON request body.",
    );
  }

  try {
    const draft = validateEvaluationDraft(body);
    const created = await dependencies.create(draft);

    return json(
      {
        buyerPath: capabilityPath(
          `/results/${created.id}`,
          created.buyerToken,
        ),
        evaluationId: created.id,
        expiresAt: created.expiresAt,
        sellerPath: capabilityPath(
          `/submit/${created.id}`,
          created.sellerToken,
        ),
        status: created.status,
      },
      201,
    );
  } catch (error) {
    if (error instanceof EvaluationInputError) {
      return apiError(400, error.code, error.message);
    }

    return serviceFailure(error);
  }
}

export async function handlePreviewEvaluationContracts(
  request: Request,
) {
  void request;
  return apiError(
    410,
    "question_only_workflow",
    "Buyers provide plain-text questions only. Every question is evaluated by 0G after seller submission.",
  );
}

export async function handleGetEvaluation(
  request: Request,
  evaluationId: string,
  dependencies: ReadDependencies = READ_DEPENDENCIES,
) {
  const token = readBearerToken(request);

  if (!isEvaluationId(evaluationId) || !isCapabilityToken(token)) {
    return unavailable();
  }

  try {
    const buyerView = await dependencies.getBuyer(evaluationId, token);

    if (buyerView) {
      return json({
        evaluation: buyerView,
        role: "buyer",
      });
    }

    const sellerView = await dependencies.getSeller(evaluationId, token);

    if (sellerView) {
      return json({
        evaluation: sellerView,
        role: "seller",
      });
    }

    return unavailable();
  } catch (error) {
    return serviceFailure(error);
  }
}

export async function handleSubmitEvaluation(
  request: Request,
  evaluationId: string,
  dependencies: SubmitDependencies = SUBMIT_DEPENDENCIES,
) {
  const token = readBearerToken(request);

  if (!isEvaluationId(evaluationId) || !isCapabilityToken(token)) {
    return unavailable();
  }

  if (declaredSizeExceeds(request, MAXIMUM_MULTIPART_BODY_BYTES)) {
    return apiError(
      413,
      "sample_too_large",
      "The dataset sample must not exceed 200 KB.",
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return apiError(
      400,
      "invalid_form",
      "Submit one supported dataset file using the sample field.",
    );
  }

  if (
    [...formData.keys()].some((key) => key !== "sample") ||
    formData.getAll("sample").length !== 1
  ) {
    return apiError(
      400,
      "invalid_form",
      "Submit exactly one supported dataset file using the sample field.",
    );
  }

  const sample = formData.get("sample");

  if (!(sample instanceof File)) {
    return apiError(
      400,
      "missing_sample",
      "Select a dataset sample to submit.",
    );
  }

  if (sample.size > PRODUCT_LIMITS.maximumFileBytes) {
    return apiError(
      413,
      "sample_too_large",
      "The dataset sample must not exceed 200 KB.",
    );
  }

  try {
    await dependencies.submit({
      bytes: new Uint8Array(await sample.arrayBuffer()),
      evaluationId,
      fileName: sample.name,
      sellerToken: token,
    });

    return json({ status: "complete" });
  } catch (error) {
    if (error instanceof SampleError) {
      return apiError(400, error.code, error.message);
    }

    if (error instanceof SampleSubmissionError) {
      switch (error.code) {
        case "evaluation_unavailable":
          return unavailable();
        case "already_processing":
          return apiError(
            409,
            error.code,
            "This evaluation is already processing or complete.",
          );
        case "scoring_failed":
          return apiError(
            502,
            error.code,
            "Evaluation failed — no scores were produced. The seller can retry.",
          );
        case "result_persistence_failed":
          return apiError(
            503,
            error.code,
            "The verified result could not be stored.",
          );
      }
    }

    return serviceFailure(error);
  }
}

function capabilityPath(path: string, token: string) {
  return `${path}#token=${encodeURIComponent(token)}`;
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length);
  return token.length > 0 && token === token.trim() ? token : null;
}

function isEvaluationId(value: string) {
  return UUID_PATTERN.test(value);
}

function declaredSizeExceeds(request: Request, maximumBytes: number) {
  const value = request.headers.get("content-length");

  if (value === null) {
    return false;
  }

  const size = Number(value);
  return Number.isFinite(size) && size > maximumBytes;
}

function unavailable() {
  return apiError(
    404,
    "evaluation_unavailable",
    "This private evaluation link is invalid or expired.",
  );
}

function serviceFailure(error: unknown) {
  const code =
    error instanceof EvaluationRepositoryError
      ? error.code
      : "service_unavailable";

  return apiError(
    503,
    code,
    "CipherQuery is temporarily unavailable. Try again.",
  );
}

function apiError(status: number, code: string, message: string) {
  return json({ error: { code, message } }, status);
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}
