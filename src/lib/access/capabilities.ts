import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const CAPABILITY_BYTES = 32;
const HASH_HEX_LENGTH = 64;
const MINIMUM_PEPPER_LENGTH = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type EvaluationCapabilities = {
  buyer: {
    hash: string;
    token: string;
  };
  seller: {
    hash: string;
    token: string;
  };
};

export class CapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapabilityError";
  }
}

export function getCapabilityPepper(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const pepper = environment.ACCESS_TOKEN_PEPPER?.trim() ?? "";

  if (pepper.length < MINIMUM_PEPPER_LENGTH) {
    throw new CapabilityError(
      "ACCESS_TOKEN_PEPPER must contain at least 32 characters.",
    );
  }

  return pepper;
}

export function issueEvaluationCapabilities(
  pepper = getCapabilityPepper(),
): EvaluationCapabilities {
  const buyerToken = randomBytes(CAPABILITY_BYTES).toString("base64url");
  const sellerToken = randomBytes(CAPABILITY_BYTES).toString("base64url");

  return {
    buyer: {
      hash: hashCapabilityToken(buyerToken, pepper),
      token: buyerToken,
    },
    seller: {
      hash: hashCapabilityToken(sellerToken, pepper),
      token: sellerToken,
    },
  };
}

export function hashCapabilityToken(token: string, pepper: string) {
  assertCapabilityToken(token);
  assertPepper(pepper);

  return createHmac("sha256", pepper).update(token).digest("hex");
}

export function verifyCapabilityToken(
  token: string,
  expectedHash: string,
  pepper = getCapabilityPepper(),
) {
  if (
    !TOKEN_PATTERN.test(token) ||
    !new RegExp(`^[0-9a-f]{${HASH_HEX_LENGTH}}$`).test(expectedHash)
  ) {
    return false;
  }

  const actual = Buffer.from(hashCapabilityToken(token, pepper), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return timingSafeEqual(actual, expected);
}

function assertCapabilityToken(token: string) {
  if (!TOKEN_PATTERN.test(token)) {
    throw new CapabilityError("Capability token has an invalid format.");
  }
}

function assertPepper(pepper: string) {
  if (pepper.length < MINIMUM_PEPPER_LENGTH) {
    throw new CapabilityError(
      "Capability token pepper must contain at least 32 characters.",
    );
  }
}
