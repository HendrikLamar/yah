export const DEFAULT_THRESHOLDS = [0.8, 1.0, 1.2] as const;

export type CrossedThreshold = {
  threshold: number;
  ratio: number;
};

export function crossedThresholds(
  spent: number,
  limit: number,
  thresholds: readonly number[] = DEFAULT_THRESHOLDS,
): CrossedThreshold[] {
  if (limit <= 0) return [];
  const ratio = spent / limit;
  return thresholds
    .filter((t) => ratio >= t)
    .map((t) => ({ threshold: t, ratio }));
}
