const DEFAULT_BASE_URL = "https://router-api.0g.ai/v1";
const DEFAULT_TIMEOUT_MS = 30_000;
const PRIVATE_TRUST_MODE = "private";

export type ZeroGMessage = {
  content: string;
  role: "assistant" | "system" | "user";
};

export type ZeroGTrace = {
  model: string;
  provider: string;
  requestId: string;
  teeVerified: true;
};

export type ZeroGRequestDiagnostics = {
  attempt: number;
  billing: {
    inputCostNeuron: string | null;
    outputCostNeuron: string | null;
    totalCostNeuron: string | null;
  };
  durationMs: number;
  finishReason: string | null;
  httpStatus: number | null;
  outcome:
    | "http_error"
    | "invalid_response"
    | "network_error"
    | "succeeded"
    | "unverified_response";
  reasoningContentPresent: boolean | null;
  responseLength: number | null;
  usage: {
    completionTokens: number | null;
    promptTokens: number | null;
    reasoningTokens: number | null;
    totalTokens: number | null;
  };
};

export type VerifiedCompletion = {
  content: string;
  diagnostics: ZeroGRequestDiagnostics[];
  trace: ZeroGTrace;
};

export type ZeroGClientConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

type RequestOptions = {
  config?: ZeroGClientConfig;
  disableThinking?: boolean;
  fetchImplementation?: typeof fetch;
  maxTokens?: number;
  responseFormat?: "json_object";
  signal?: AbortSignal;
};

type RouterResponse = {
  choices?: Array<{
    finish_reason?: unknown;
    message?: {
      content?: unknown;
      provider_specific_fields?: {
        reasoning_content?: unknown;
      };
      reasoning_content?: unknown;
    };
  }>;
  model?: unknown;
  usage?: {
    completion_tokens?: unknown;
    completion_tokens_details?: {
      reasoning_tokens?: unknown;
    };
    prompt_tokens?: unknown;
    total_tokens?: unknown;
  };
  x_0g_trace?: {
    billing?: {
      input_cost?: unknown;
      output_cost?: unknown;
      total_cost?: unknown;
    };
    provider?: unknown;
    request_id?: unknown;
    tee_verified?: unknown;
  };
};

export class ZeroGClientError extends Error {
  constructor(
    message: string,
    readonly code:
      | "configuration_error"
      | "invalid_response"
      | "request_failed"
      | "unverified_response",
    readonly status?: number,
    readonly diagnostics: ZeroGRequestDiagnostics[] = [],
  ) {
    super(message);
    this.name = "ZeroGClientError";
  }
}

export function getZeroGConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ZeroGClientConfig {
  const apiKey = environment.ZERO_G_API_KEY?.trim() ?? "";
  const baseUrl = (
    environment.ZERO_G_BASE_URL?.trim() || DEFAULT_BASE_URL
  ).replace(/\/$/, "");
  const model = environment.ZERO_G_MODEL?.trim() ?? "";

  if (!apiKey.startsWith("sk-")) {
    throw new ZeroGClientError(
      "ZERO_G_API_KEY must be an sk- inference key.",
      "configuration_error",
    );
  }

  if (!model) {
    throw new ZeroGClientError(
      "ZERO_G_MODEL must select a private-capable model.",
      "configuration_error",
    );
  }

  let parsedBaseUrl: URL;

  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new ZeroGClientError(
      "ZERO_G_BASE_URL must be a valid URL.",
      "configuration_error",
    );
  }

  if (parsedBaseUrl.protocol !== "https:") {
    throw new ZeroGClientError(
      "ZERO_G_BASE_URL must use HTTPS.",
      "configuration_error",
    );
  }

  if (
    environment.VERCEL_ENV === "production" &&
    baseUrl !== DEFAULT_BASE_URL
  ) {
    throw new ZeroGClientError(
      "Production must use the 0G mainnet Router base URL.",
      "configuration_error",
    );
  }

  return { apiKey, baseUrl, model };
}

export async function requestVerifiedPrivateCompletion(
  messages: ZeroGMessage[],
  options: RequestOptions = {},
): Promise<VerifiedCompletion> {
  const config = options.config ?? getZeroGConfig();
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const signal =
    options.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  const diagnostics: ZeroGRequestDiagnostics[] = [];
  const attempt = 1;
  const startedAt = Date.now();
  let response: Response;

  try {
    response = await fetchImplementation(
      `${config.baseUrl}/chat/completions`,
      {
        body: JSON.stringify({
          ...(options.disableThinking && isGlmModel(config.model)
            ? {
                chat_template_kwargs: {
                  enable_thinking: false,
                },
              }
            : {}),
          max_tokens: options.maxTokens ?? 256,
          messages,
          model: config.model,
          ...(options.responseFormat
            ? {
                response_format: {
                  type: options.responseFormat,
                },
              }
            : {}),
          temperature: 0,
          verify_tee: true,
        }),
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "X-0G-Provider-Trust-Mode": PRIVATE_TRUST_MODE,
        },
        method: "POST",
        signal,
      },
    );
  } catch {
    diagnostics.push(
      emptyDiagnostics(
        attempt,
        elapsedMs(startedAt),
        null,
        "network_error",
      ),
    );
    throw new ZeroGClientError(
      "0G Router request failed before receiving a response.",
      "request_failed",
      undefined,
      diagnostics,
    );
  }

  if (!response.ok) {
    diagnostics.push(
      emptyDiagnostics(
        attempt,
        elapsedMs(startedAt),
        response.status,
        "http_error",
      ),
    );
    throw new ZeroGClientError(
      `0G Router request failed with status ${response.status}.`,
      "request_failed",
      response.status,
      diagnostics,
    );
  }

  let payload: RouterResponse;

  try {
    payload = (await response.json()) as RouterResponse;
  } catch {
    diagnostics.push(
      emptyDiagnostics(
        attempt,
        elapsedMs(startedAt),
        response.status,
        "invalid_response",
      ),
    );
    throw new ZeroGClientError(
      "0G Router returned an unreadable response.",
      "invalid_response",
      response.status,
      diagnostics,
    );
  }

  return parseVerifiedResponse(
    payload,
    config.model,
    diagnostics,
    attempt,
    elapsedMs(startedAt),
    response.status,
  );
}

function parseVerifiedResponse(
  payload: RouterResponse,
  requestedModel: string,
  priorDiagnostics: ZeroGRequestDiagnostics[],
  attempt: number,
  durationMs: number,
  httpStatus: number,
): VerifiedCompletion {
  const content = payload.choices?.[0]?.message?.content;
  const provider = payload.x_0g_trace?.provider;
  const requestId = payload.x_0g_trace?.request_id;
  const teeVerified = payload.x_0g_trace?.tee_verified;
  const responseDiagnostics = diagnosticsFromPayload(
    payload,
    attempt,
    durationMs,
    httpStatus,
    teeVerified === true ? "succeeded" : "unverified_response",
  );
  const diagnostics = [...priorDiagnostics, responseDiagnostics];

  if (teeVerified !== true) {
    throw new ZeroGClientError(
      "0G Router did not return a verified TEE result.",
      "unverified_response",
      httpStatus,
      diagnostics,
    );
  }

  if (
    typeof content !== "string" ||
    typeof provider !== "string" ||
    typeof requestId !== "string"
  ) {
    throw new ZeroGClientError(
      "0G Router returned an incomplete response.",
      "invalid_response",
      httpStatus,
      [
        ...priorDiagnostics,
        { ...responseDiagnostics, outcome: "invalid_response" },
      ],
    );
  }

  return {
    content,
    diagnostics,
    trace: {
      model:
        typeof payload.model === "string" ? payload.model : requestedModel,
      provider,
      requestId,
      teeVerified: true,
    },
  };
}

function diagnosticsFromPayload(
  payload: RouterResponse,
  attempt: number,
  durationMs: number,
  httpStatus: number,
  outcome: ZeroGRequestDiagnostics["outcome"],
): ZeroGRequestDiagnostics {
  const billing = payload.x_0g_trace?.billing;
  const choice = payload.choices?.[0];
  const content = choice?.message?.content;
  const reasoningContent =
    choice?.message?.reasoning_content ??
    choice?.message?.provider_specific_fields?.reasoning_content;
  const usage = payload.usage;

  return {
    attempt,
    billing: {
      inputCostNeuron: neuronValue(billing?.input_cost),
      outputCostNeuron: neuronValue(billing?.output_cost),
      totalCostNeuron: neuronValue(billing?.total_cost),
    },
    durationMs,
    finishReason: boundedString(choice?.finish_reason),
    httpStatus,
    outcome,
    reasoningContentPresent:
      typeof reasoningContent === "string"
        ? reasoningContent.length > 0
        : null,
    responseLength:
      typeof content === "string" ? content.length : null,
    usage: {
      completionTokens: tokenCount(usage?.completion_tokens),
      promptTokens: tokenCount(usage?.prompt_tokens),
      reasoningTokens: tokenCount(
        usage?.completion_tokens_details?.reasoning_tokens,
      ),
      totalTokens: tokenCount(usage?.total_tokens),
    },
  };
}

function emptyDiagnostics(
  attempt: number,
  durationMs: number,
  httpStatus: number | null,
  outcome: ZeroGRequestDiagnostics["outcome"],
): ZeroGRequestDiagnostics {
  return {
    attempt,
    billing: {
      inputCostNeuron: null,
      outputCostNeuron: null,
      totalCostNeuron: null,
    },
    durationMs,
    finishReason: null,
    httpStatus,
    outcome,
    reasoningContentPresent: null,
    responseLength: null,
    usage: {
      completionTokens: null,
      promptTokens: null,
      reasoningTokens: null,
      totalTokens: null,
    },
  };
}

function boundedString(value: unknown) {
  return typeof value === "string" && value.length <= 64 ? value : null;
}

function tokenCount(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function neuronValue(value: unknown) {
  return typeof value === "string" && /^\d{1,80}$/.test(value)
    ? value
    : null;
}

function elapsedMs(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

function isGlmModel(model: string) {
  return model.toLowerCase().includes("glm");
}
