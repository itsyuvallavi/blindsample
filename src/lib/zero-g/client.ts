const DEFAULT_BASE_URL =
  "https://router-api-testnet.integratenetwork.work/v1";
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_TIMEOUT_MS = 30_000;
const PRIVATE_TRUST_MODE = "private";
const RETRYABLE_STATUS_CODES = new Set([429, 503]);

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
  fetchImplementation?: typeof fetch;
  maxTokens?: number;
  retryDelayMs?: number;
  signal?: AbortSignal;
};

type RouterResponse = {
  choices?: Array<{
    finish_reason?: unknown;
    message?: {
      content?: unknown;
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

  return { apiKey, baseUrl, model };
}

export async function requestVerifiedPrivateCompletion(
  messages: ZeroGMessage[],
  options: RequestOptions = {},
): Promise<VerifiedCompletion> {
  const config = options.config ?? getZeroGConfig();
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const signal =
    options.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  const diagnostics: ZeroGRequestDiagnostics[] = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetchImplementation(
        `${config.baseUrl}/chat/completions`,
        {
          body: JSON.stringify({
            max_tokens: options.maxTokens ?? 256,
            messages,
            model: config.model,
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
          attempt + 1,
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
          attempt + 1,
          elapsedMs(startedAt),
          response.status,
          "http_error",
        ),
      );
      const shouldRetry =
        attempt === 0 && RETRYABLE_STATUS_CODES.has(response.status);

      if (shouldRetry) {
        await wait(retryDelayMs);
        continue;
      }

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
          attempt + 1,
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
      attempt + 1,
      elapsedMs(startedAt),
      response.status,
    );
  }

  throw new ZeroGClientError(
    "0G Router request failed after retry.",
    "request_failed",
    undefined,
    diagnostics,
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

async function wait(delayMs: number) {
  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
