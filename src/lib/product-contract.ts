export const PRODUCT_LIMITS = {
  maximumColumns: 20,
  maximumDecodedFileBytes: 1_000_000,
  maximumFileBytes: 200_000,
  maximumNormalizedBytes: 200_000,
  maximumQuestionCharacters: 300,
  maximumQuestions: 20,
  maximumRows: 50,
  maximumTitleCharacters: 80,
  scoreMaximum: 100,
  scoreMinimum: 0,
} as const;

export function isValidScore(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    Number(value) >= PRODUCT_LIMITS.scoreMinimum &&
    Number(value) <= PRODUCT_LIMITS.scoreMaximum
  );
}
