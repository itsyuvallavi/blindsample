export const PRODUCT_LIMITS = {
  maximumColumns: 20,
  maximumFileBytes: 200_000,
  maximumQuestionCharacters: 300,
  maximumQuestions: 20,
  maximumRows: 200,
  maximumTitleCharacters: 80,
  scoreMaximum: 100,
  scoreMinimum: 1,
} as const;

export function isValidScore(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    Number(value) >= PRODUCT_LIMITS.scoreMinimum &&
    Number(value) <= PRODUCT_LIMITS.scoreMaximum
  );
}
