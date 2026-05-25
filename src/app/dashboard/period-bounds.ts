import type { Granularity } from "@/lib/analysis/timeseries";

export function periodBounds(
  periodStart: Date,
  granularity: Granularity,
): { from: Date; to: Date } {
  if (granularity === "month") {
    const from = new Date(
      Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 1),
    );
    const to = new Date(
      Date.UTC(
        periodStart.getUTCFullYear(),
        periodStart.getUTCMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ),
    );
    return { from, to };
  }
  if (granularity === "week") {
    const from = new Date(periodStart);
    const to = new Date(periodStart);
    to.setUTCDate(to.getUTCDate() + 6);
    to.setUTCHours(23, 59, 59, 999);
    return { from, to };
  }
  const from = new Date(periodStart);
  const to = new Date(periodStart);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}
