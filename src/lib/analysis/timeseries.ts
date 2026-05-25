export type Granularity = "day" | "week" | "month";

export type AnalysisTransaction = {
  bookingDate: Date;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  counterpartyName: string | null;
  isInternalTransfer?: boolean;
  categoryName?: string | null;
  purposeRawSearchHint?: string;
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
  previousPeriodAbs: number;
  deltaPct: number | null;
};

export type CategoryPivotPoint = {
  periodKey: string;
  periodStart: Date;
  totals: Record<string, number>;
};

export type CategoryPivot = {
  categories: string[];
  points: CategoryPivotPoint[];
  uncategorizedShare: number;
};

export type IncomeBucket = "salary" | "side" | "refund" | "investment" | "other";

export type IncomeCompositionSlice = {
  bucket: IncomeBucket;
  label: string;
  amount: number;
  topPayors: Array<{ name: string; amount: number }>;
};

export type IncomeCompositionHistoryPoint = {
  periodKey: string;
  periodStart: Date;
  salary: number;
  side: number;
  refund: number;
  investment: number;
  other: number;
};

export type IncomeComposition = {
  slices: IncomeCompositionSlice[];
  history: IncomeCompositionHistoryPoint[];
  total: number;
};

export type SavingsRatePoint = {
  periodKey: string;
  periodStart: Date;
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  savingsRateAvg3: number | null;
};

const INCOME_BUCKET_LABELS: Record<IncomeBucket, string> = {
  salary: "Gehalt",
  side: "Nebeneinkommen",
  refund: "Rückerstattung",
  investment: "Investitionen",
  other: "Sonstiges",
};

const REFUND_KEYWORDS = ["refund", "rückzahlung", "erstattung", "rueckzahlung"];
const INVESTMENT_KEYWORDS = [
  "dividend",
  "dividende",
  "zinsen",
  "interest",
  "etf",
  "broker",
  "trade republic",
  "scalable",
];

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

  const { previousFrom, previousTo } = previousPeriod(range);
  const previousFiltered = previousFrom && previousTo
    ? transactions.filter(
        (t) =>
          !t.isInternalTransfer &&
          t.direction === "EXPENSE" &&
          t.bookingDate >= previousFrom &&
          t.bookingDate <= previousTo,
      )
    : [];

  const map = new Map<string, { totalAbs: number; count: number; lastSeen: Date }>();
  for (const t of filtered) {
    const key = counterpartyKey(t.counterpartyName);
    const row = map.get(key) ?? { totalAbs: 0, count: 0, lastSeen: t.bookingDate };
    row.totalAbs += Math.abs(t.amount);
    row.count += 1;
    if (t.bookingDate > row.lastSeen) row.lastSeen = t.bookingDate;
    map.set(key, row);
  }

  const previousMap = new Map<string, number>();
  for (const t of previousFiltered) {
    const key = counterpartyKey(t.counterpartyName);
    previousMap.set(key, (previousMap.get(key) ?? 0) + Math.abs(t.amount));
  }

  return Array.from(map.entries())
    .map(([name, value]) => {
      const previousPeriodAbs = previousMap.get(name) ?? 0;
      const deltaPct = previousPeriodAbs > 0
        ? ((value.totalAbs - previousPeriodAbs) / previousPeriodAbs) * 100
        : null;
      return {
        name,
        totalAbs: value.totalAbs,
        count: value.count,
        lastSeen: value.lastSeen,
        previousPeriodAbs,
        deltaPct,
      };
    })
    .sort((a, b) => b.totalAbs - a.totalAbs)
    .slice(0, topN);
}

export function aggregateCategorySpend(
  transactions: AnalysisTransaction[],
  granularity: Granularity,
  topN: number,
  range?: { from: Date; to: Date },
): CategoryPivot {
  const filtered = filterByRange(transactions, range)
    .filter((t) => !t.isInternalTransfer && t.direction === "EXPENSE");

  if (filtered.length === 0) {
    return { categories: [], points: [], uncategorizedShare: 0 };
  }

  const totalsByCategory = new Map<string, number>();
  for (const t of filtered) {
    const key = (t.categoryName ?? "Uncategorized").trim() || "Uncategorized";
    totalsByCategory.set(key, (totalsByCategory.get(key) ?? 0) + Math.abs(t.amount));
  }

  const ranked = Array.from(totalsByCategory.entries()).sort((a, b) => b[1] - a[1]);
  const topCategories = ranked.slice(0, topN).map(([name]) => name);
  const hasOther = ranked.length > topN;
  const categories = hasOther ? [...topCategories, "Andere"] : topCategories;

  const totalSpend = ranked.reduce((sum, [, v]) => sum + v, 0);
  const uncategorizedShare = totalSpend > 0
    ? (totalsByCategory.get("Uncategorized") ?? 0) / totalSpend
    : 0;

  const buckets = new Map<string, CategoryPivotPoint>();
  for (const t of filtered) {
    const periodStart = bucketStart(t.bookingDate, granularity);
    const key = periodStart.toISOString();
    const bucket = buckets.get(key) ?? {
      periodKey: formatBucketKey(periodStart, granularity),
      periodStart,
      totals: Object.fromEntries(categories.map((c) => [c, 0])),
    };
    const rawCategory = (t.categoryName ?? "Uncategorized").trim() || "Uncategorized";
    const bucketCategory = topCategories.includes(rawCategory)
      ? rawCategory
      : hasOther
        ? "Andere"
        : rawCategory;
    bucket.totals[bucketCategory] = (bucket.totals[bucketCategory] ?? 0) + Math.abs(t.amount);
    buckets.set(key, bucket);
  }

  const points = Array.from(buckets.values()).sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
  );

  return { categories, points, uncategorizedShare };
}

export function aggregateIncomeComposition(
  transactions: AnalysisTransaction[],
  range?: { from: Date; to: Date },
  granularity: Granularity = "month",
): IncomeComposition {
  const filtered = filterByRange(transactions, range)
    .filter((t) => !t.isInternalTransfer && t.direction === "INCOME");

  if (filtered.length === 0) {
    return { slices: [], history: [], total: 0 };
  }

  const payors = new Map<string, { amount: number; occurrences: number }>();
  for (const t of filtered) {
    const key = counterpartyKey(t.counterpartyName);
    const row = payors.get(key) ?? { amount: 0, occurrences: 0 };
    row.amount += t.amount;
    row.occurrences += 1;
    payors.set(key, row);
  }

  const salaryPayors = inferSalaryPayors(payors);
  const totalsByBucket: Record<IncomeBucket, number> = {
    salary: 0,
    side: 0,
    refund: 0,
    investment: 0,
    other: 0,
  };
  const payorsByBucket: Record<IncomeBucket, Map<string, number>> = {
    salary: new Map(),
    side: new Map(),
    refund: new Map(),
    investment: new Map(),
    other: new Map(),
  };

  for (const t of filtered) {
    const payorKey = counterpartyKey(t.counterpartyName);
    const bucket = classifyIncome(t, payorKey, salaryPayors);
    totalsByBucket[bucket] += t.amount;
    payorsByBucket[bucket].set(
      payorKey,
      (payorsByBucket[bucket].get(payorKey) ?? 0) + t.amount,
    );
  }

  const slices: IncomeCompositionSlice[] = (Object.keys(totalsByBucket) as IncomeBucket[])
    .map((bucket) => ({
      bucket,
      label: INCOME_BUCKET_LABELS[bucket],
      amount: totalsByBucket[bucket],
      topPayors: Array.from(payorsByBucket[bucket].entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, amount]) => ({ name, amount })),
    }))
    .filter((slice) => slice.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const total = slices.reduce((sum, s) => sum + s.amount, 0);

  const historyBuckets = new Map<string, IncomeCompositionHistoryPoint>();
  for (const t of filtered) {
    const periodStart = bucketStart(t.bookingDate, granularity);
    const key = periodStart.toISOString();
    const point = historyBuckets.get(key) ?? {
      periodKey: formatBucketKey(periodStart, granularity),
      periodStart,
      salary: 0,
      side: 0,
      refund: 0,
      investment: 0,
      other: 0,
    };
    const payorKey = counterpartyKey(t.counterpartyName);
    const bucket = classifyIncome(t, payorKey, salaryPayors);
    point[bucket] += t.amount;
    historyBuckets.set(key, point);
  }

  const history = Array.from(historyBuckets.values()).sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
  );

  return { slices, history, total };
}

export function aggregateSavingsRateOverTime(
  transactions: AnalysisTransaction[],
  range?: { from: Date; to: Date },
): SavingsRatePoint[] {
  const filtered = filterByRange(transactions, range).filter((t) => !t.isInternalTransfer);

  const buckets = new Map<string, { periodStart: Date; income: number; expenses: number }>();
  for (const t of filtered) {
    const periodStart = bucketStart(t.bookingDate, "month");
    const key = periodStart.toISOString();
    const bucket = buckets.get(key) ?? { periodStart, income: 0, expenses: 0 };
    if (t.direction === "INCOME") bucket.income += t.amount;
    else bucket.expenses += Math.abs(t.amount);
    buckets.set(key, bucket);
  }

  const sorted = Array.from(buckets.values()).sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
  );

  return sorted.map((bucket, index) => {
    const net = bucket.income - bucket.expenses;
    const savingsRate = bucket.income > 0 ? (net / bucket.income) * 100 : 0;
    const window = sorted.slice(Math.max(0, index - 2), index + 1);
    const enoughForAverage = window.length >= 3;
    const avg = enoughForAverage
      ? window.reduce((sum, w) => {
          const wNet = w.income - w.expenses;
          return sum + (w.income > 0 ? (wNet / w.income) * 100 : 0);
        }, 0) / window.length
      : null;
    return {
      periodKey: formatBucketKey(bucket.periodStart, "month"),
      periodStart: bucket.periodStart,
      income: bucket.income,
      expenses: bucket.expenses,
      net,
      savingsRate,
      savingsRateAvg3: avg,
    };
  });
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

function counterpartyKey(name: string | null | undefined): string {
  if (!name) return "Unbekannt";
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "Unbekannt";
}

function previousPeriod(range?: { from: Date; to: Date }): {
  previousFrom: Date | null;
  previousTo: Date | null;
} {
  if (!range) return { previousFrom: null, previousTo: null };
  const durationMs = range.to.getTime() - range.from.getTime();
  if (durationMs <= 0) return { previousFrom: null, previousTo: null };
  const previousTo = new Date(range.from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - durationMs);
  return { previousFrom, previousTo };
}

function inferSalaryPayors(
  payors: Map<string, { amount: number; occurrences: number }>,
): Set<string> {
  const result = new Set<string>();
  for (const [name, info] of payors.entries()) {
    if (info.occurrences >= 2 && info.amount >= 1000) {
      result.add(name);
    }
  }
  return result;
}

function classifyIncome(
  t: AnalysisTransaction,
  payorKey: string,
  salaryPayors: Set<string>,
): IncomeBucket {
  const haystack = `${t.purposeRawSearchHint ?? ""} ${t.counterpartyName ?? ""}`.toLowerCase();
  if (REFUND_KEYWORDS.some((kw) => haystack.includes(kw))) return "refund";
  if (INVESTMENT_KEYWORDS.some((kw) => haystack.includes(kw))) return "investment";
  if (salaryPayors.has(payorKey)) return "salary";
  if (t.amount < 200) return "other";
  return "side";
}

