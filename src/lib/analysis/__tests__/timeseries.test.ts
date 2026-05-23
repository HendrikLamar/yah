import { describe, expect, it } from "vitest";

import {
  aggregateCashflowByPeriod,
  aggregateTopCounterparties,
  defaultRange,
  parseGranularity,
  parseRange,
  type AnalysisTransaction,
} from "../timeseries";

const transactions: AnalysisTransaction[] = [
  {
    bookingDate: new Date("2026-03-15"),
    amount: 3200,
    direction: "INCOME",
    counterpartyName: "Employer",
  },
  {
    bookingDate: new Date("2026-03-20"),
    amount: -120,
    direction: "EXPENSE",
    counterpartyName: "REWE",
  },
  {
    bookingDate: new Date("2026-04-02"),
    amount: -50,
    direction: "EXPENSE",
    counterpartyName: "REWE",
  },
  {
    bookingDate: new Date("2026-04-10"),
    amount: -200,
    direction: "EXPENSE",
    counterpartyName: "Amazon",
  },
  {
    bookingDate: new Date("2026-04-15"),
    amount: 3200,
    direction: "INCOME",
    counterpartyName: "Employer",
  },
  {
    bookingDate: new Date("2026-04-18"),
    amount: -500,
    direction: "EXPENSE",
    counterpartyName: "Hendrik Sparkonto",
    isInternalTransfer: true,
  },
];

describe("aggregateCashflowByPeriod", () => {
  it("groups by month, sums income and expenses, computes net", () => {
    const points = aggregateCashflowByPeriod(transactions, "month");

    expect(points).toHaveLength(2);

    expect(points[0]?.periodKey).toBe("2026-03");
    expect(points[0]?.income).toBe(3200);
    expect(points[0]?.expenses).toBe(120);
    expect(points[0]?.net).toBe(3080);

    expect(points[1]?.periodKey).toBe("2026-04");
    expect(points[1]?.income).toBe(3200);
    expect(points[1]?.expenses).toBe(250);
    expect(points[1]?.net).toBe(2950);
  });

  it("excludes internal transfers from income and expenses", () => {
    const points = aggregateCashflowByPeriod(transactions, "month");
    const april = points.find((p) => p.periodKey === "2026-04");
    expect(april?.expenses).toBe(250);
    expect(april?.count).toBe(3);
  });

  it("filters by date range", () => {
    const points = aggregateCashflowByPeriod(transactions, "month", {
      from: new Date("2026-04-01"),
      to: new Date("2026-04-30"),
    });
    expect(points).toHaveLength(1);
    expect(points[0]?.periodKey).toBe("2026-04");
  });

  it("supports week granularity", () => {
    const points = aggregateCashflowByPeriod(transactions, "week");
    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      expect(point.periodStart.getUTCDay()).toBe(1);
    }
  });

  it("supports day granularity", () => {
    const points = aggregateCashflowByPeriod(transactions, "day");
    expect(points.length).toBe(transactions.filter((t) => !t.isInternalTransfer).length);
  });
});

describe("aggregateTopCounterparties", () => {
  it("ranks counterparties by absolute expense, excluding income and transfers", () => {
    const rows = aggregateTopCounterparties(transactions, 5);
    expect(rows.map((r) => r.name)).toEqual(["Amazon", "REWE"]);
    expect(rows[0]?.totalAbs).toBe(200);
    expect(rows[1]?.totalAbs).toBe(170);
  });

  it("respects topN", () => {
    const rows = aggregateTopCounterparties(transactions, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Amazon");
  });

  it("groups null counterparty names under 'Unbekannt'", () => {
    const rows = aggregateTopCounterparties(
      [
        {
          bookingDate: new Date("2026-04-01"),
          amount: -42,
          direction: "EXPENSE",
          counterpartyName: null,
        },
      ],
      5,
    );
    expect(rows[0]?.name).toBe("Unbekannt");
  });
});

describe("parseRange / parseGranularity / defaultRange", () => {
  it("defaultRange returns last-12-months window ending today", () => {
    const now = new Date("2026-05-23T12:00:00Z");
    const range = defaultRange(now);
    expect(range.from.toISOString().slice(0, 10)).toBe("2025-05-01");
    expect(range.to.toISOString().slice(0, 10)).toBe("2026-05-23");
  });

  it("parseRange honours valid ISO dates and falls back otherwise", () => {
    const now = new Date("2026-05-23T12:00:00Z");
    const valid = parseRange("2026-01-01", "2026-04-30", now);
    expect(valid.from.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(valid.to.toISOString().slice(0, 10)).toBe("2026-04-30");

    const fallback = parseRange("not-a-date", undefined, now);
    expect(fallback.from.toISOString().slice(0, 10)).toBe("2025-05-01");
  });

  it("parseGranularity defaults to month for unknown values", () => {
    expect(parseGranularity("day")).toBe("day");
    expect(parseGranularity("week")).toBe("week");
    expect(parseGranularity("month")).toBe("month");
    expect(parseGranularity("nope")).toBe("month");
    expect(parseGranularity(undefined)).toBe("month");
  });
});
