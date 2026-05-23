export type Granularity = "day" | "week" | "month";

export type AnalysisTransaction = {
  bookingDate: Date;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  counterpartyName: string | null;
  isInternalTransfer?: boolean;
};

export type CashflowPoint = {
  periodKey: string;
  periodStart: Date;
  income: number;
  expenses: number;
  net: number;
  count: number;
};

export type CounterpartyRow = {
  name: string;
  totalAbs: number;
  count: number;
  lastSeen: Date;
};

export function aggregateCashflowByPeriod(
  transactions: AnalysisTransaction[],
  granularity: Granularity,
  range?: { from: Date; to: Date },
): CashflowPoint[] {
  const filtered = filterByRange(transactions, range).filter((t) => !t.isInternalTransfer);

  const buckets = new Map<
    string,
    { periodStart: Date; income: number; expenses: number; count: number }
  >();

  for (const t of filtered) {
    const periodStart = bucketStart(t.bookingDate, granularity);
    const key = periodStart.toISOString();
    const bucket = buckets.get(key) ?? {
      periodStart,
      income: 0,
      expenses: 0,
      count: 0,
    };

    if (t.direction === "INCOME") {
      bucket.income += t.amount;
    } else {
      bucket.expenses += Math.abs(t.amount);
    }
    bucket.count += 1;

    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime())
    .map((bucket) => ({
      periodKey: formatBucketKey(bucket.periodStart, granularity),
      periodStart: bucket.periodStart,
      income: bucket.income,
      expenses: bucket.expenses,
      net: bucket.income - bucket.expenses,
      count: bucket.count,
    }));
}

export function aggregateTopCounterparties(
  transactions: AnalysisTransaction[],
  topN: number,
  range?: { from: Date; to: Date },
): CounterpartyRow[] {
  const filtered = filterByRange(transactions, range)
    .filter((t) => !t.isInternalTransfer && t.direction === "EXPENSE");

  const map = new Map<string, CounterpartyRow>();
  for (const t of filtered) {
    const key = (t.counterpartyName ?? "Unbekannt").trim() || "Unbekannt";
    const row = map.get(key) ?? {
      name: key,
      totalAbs: 0,
      count: 0,
      lastSeen: t.bookingDate,
    };
    row.totalAbs += Math.abs(t.amount);
    row.count += 1;
    if (t.bookingDate > row.lastSeen) row.lastSeen = t.bookingDate;
    map.set(key, row);
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalAbs - a.totalAbs)
    .slice(0, topN);
}

export function defaultRange(now: Date = new Date()): { from: Date; to: Date } {
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );
  const from = new Date(
    Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1),
  );
  return { from, to };
}

export function parseRange(
  fromIso: string | undefined,
  toIso: string | undefined,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const fallback = defaultRange(now);
  const from = fromIso ? parseIso(fromIso) ?? fallback.from : fallback.from;
  const to = toIso ? parseIso(toIso) ?? fallback.to : fallback.to;
  return { from, to };
}

export function parseGranularity(value: string | undefined): Granularity {
  if (value === "day" || value === "week" || value === "month") return value;
  return "month";
}

function parseIso(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function filterByRange<T extends { bookingDate: Date }>(
  transactions: T[],
  range?: { from: Date; to: Date },
): T[] {
  if (!range) return transactions;
  return transactions.filter(
    (t) => t.bookingDate >= range.from && t.bookingDate <= range.to,
  );
}

function bucketStart(date: Date, granularity: Granularity): Date {
  if (granularity === "month") {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
  if (granularity === "week") {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayOfWeek = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1;
    d.setUTCDate(d.getUTCDate() - dayOfWeek);
    return d;
  }
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function formatBucketKey(date: Date, granularity: Granularity): string {
  const iso = date.toISOString().slice(0, 10);
  if (granularity === "month") return iso.slice(0, 7);
  return iso;
}
