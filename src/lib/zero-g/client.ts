const DEFAULT_BASE_URL = "https://router-api.0g.ai/v1";
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

export type VerifiedCompletion = {
  content: string;
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
    message?: {
      content?: unknown;
    };
  }>;
  model?: unknown;
  x_0g_trace?: {
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

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchImplementation(
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

    if (!response.ok) {
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
      );
    }

    const payload = (await response.json()) as RouterResponse;
    return parseVerifiedResponse(payload, config.model);
  }

  throw new ZeroGClientError(
    "0G Router request failed after retry.",
    "request_failed",
  );
}

function parseVerifiedResponse(
  payload: RouterResponse,
  requestedModel: string,
): VerifiedCompletion {
  const content = payload.choices?.[0]?.message?.content;
  const provider = payload.x_0g_trace?.provider;
  const requestId = payload.x_0g_trace?.request_id;
  const teeVerified = payload.x_0g_trace?.tee_verified;

  if (teeVerified !== true) {
    throw new ZeroGClientError(
      "0G Router did not return a verified TEE result.",
      "unverified_response",
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
    );
  }

  return {
    content,
    trace: {
      model:
        typeof payload.model === "string" ? payload.model : requestedModel,
      provider,
      requestId,
      teeVerified: true,
    },
  };
}

async function wait(delayMs: number) {
  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
