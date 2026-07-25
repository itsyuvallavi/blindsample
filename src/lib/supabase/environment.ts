export type EvaluationEnvironment =
  | "development"
  | "preview"
  | "production";

const EVALUATION_ENVIRONMENTS = new Set<EvaluationEnvironment>([
  "development",
  "preview",
  "production",
]);

export function getEvaluationEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): EvaluationEnvironment {
  const value = environment.VERCEL_ENV ?? "development";

  if (EVALUATION_ENVIRONMENTS.has(value as EvaluationEnvironment)) {
    return value as EvaluationEnvironment;
  }

  return "development";
}
