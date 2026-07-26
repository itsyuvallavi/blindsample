const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function readCapabilityToken(hash: string) {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  const parameters = new URLSearchParams(value);

  if (
    [...parameters.keys()].some((key) => key !== "token") ||
    parameters.getAll("token").length !== 1
  ) {
    return null;
  }

  const token = parameters.get("token");
  return token !== null && TOKEN_PATTERN.test(token) ? token : null;
}
