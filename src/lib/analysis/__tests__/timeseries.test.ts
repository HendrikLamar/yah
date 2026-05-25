import { describe, expect, it } from "vitest";

import {
  aggregateCashflowByPeriod,
  aggregateCategorySpend,
  aggregateIncomeComposition,
  aggregateSavingsRateOverTime,
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

  it("computes MoM delta against the prior equally-sized window", () => {
    const data: AnalysisTransaction[] = [
      // previous window: 2026-02
      {
        bookingDate: new Date("2026-02-10"),
        amount: -100,
        direction: "EXPENSE",
        counterpartyName: "REWE",
      },
      // current window: 2026-03
      {
        bookingDate: new Date("2026-03-05"),
        amount: -150,
        direction: "EXPENSE",
        counterpartyName: "REWE",
      },
      {
        bookingDate: new Date("2026-03-15"),
        amount: -200,
        direction: "EXPENSE",
        counterpartyName: "Amazon",
      },
    ];

    const rows = aggregateTopCounterparties(data, 5, {
      from: new Date("2026-03-01T00:00:00Z"),
      to: new Date("2026-03-31T23:59:59Z"),
    });

    const rewe = rows.find((r) => r.name === "REWE");
    expect(rewe?.previousPeriodAbs).toBe(100);
    expect(rewe?.deltaPct).toBe(50);

    const amazon = rows.find((r) => r.name === "Amazon");
    expect(amazon?.previousPeriodAbs).toBe(0);
    expect(amazon?.deltaPct).toBeNull();
  });
});

describe("aggregateCategorySpend", () => {
  const categorized: AnalysisTransaction[] = [
    {
      bookingDate: new Date("2026-03-05"),
      amount: -100,
      direction: "EXPENSE",
      counterpartyName: "REWE",
      categoryName: "Lebensmittel",
    },
    {
      bookingDate: new Date("2026-03-20"),
      amount: -80,
      direction: "EXPENSE",
      counterpartyName: "Aldi",
      categoryName: "Lebensmittel",
    },
    {
      bookingDate: new Date("2026-04-02"),
      amount: -250,
      direction: "EXPENSE",
      counterpartyName: "Vermieter",
      categoryName: "Miete",
    },
    {
      bookingDate: new Date("2026-04-15"),
      amount: -45,
      direction: "EXPENSE",
      counterpartyName: "Spotify",
      categoryName: "Abos",
    },
    {
      bookingDate: new Date("2026-04-18"),
      amount: -25,
      direction: "EXPENSE",
      counterpartyName: "Cafe",
      categoryName: null,
    },
  ];

  it("pivots categories across periods, top-N + Other rollup", () => {
    const result = aggregateCategorySpend(categorized, "month", 2);
    expect(result.categories).toContain("Miete");
    expect(result.categories).toContain("Lebensmittel");
    expect(result.categories).toContain("Andere");
    expect(result.points).toHaveLength(2);
    const march = result.points.find((p) => p.periodKey === "2026-03");
    expect(march?.totals["Lebensmittel"]).toBe(180);
  });

  it("reports uncategorized share", () => {
    const result = aggregateCategorySpend(categorized, "month", 5);
    expect(result.uncategorizedShare).toBeCloseTo(25 / 500, 4);
  });

  it("handles empty input", () => {
    const result = aggregateCategorySpend([], "month", 5);
    expect(result.points).toHaveLength(0);
    expect(result.uncategorizedShare).toBe(0);
  });
});

describe("aggregateIncomeComposition", () => {
  const incomeData: AnalysisTransaction[] = [
    {
      bookingDate: new Date("2026-03-25"),
      amount: 3500,
      direction: "INCOME",
      counterpartyName: "MYOTWIN GMBH",
    },
    {
      bookingDate: new Date("2026-04-25"),
      amount: 3500,
      direction: "INCOME",
      counterpartyName: "MYOTWIN GMBH",
    },
    {
      bookingDate: new Date("2026-04-12"),
      amount: 80,
      direction: "INCOME",
      counterpartyName: "Krankenkasse",
      purposeRawSearchHint: "Erstattung Brille",
    },
    {
      bookingDate: new Date("2026-04-20"),
      amount: 60,
      direction: "INCOME",
      counterpartyName: "Trade Republic",
      purposeRawSearchHint: "Dividende",
    },
    {
      bookingDate: new Date("2026-04-28"),
      amount: 150,
      direction: "INCOME",
      counterpartyName: "Freund",
    },
  ];

  it("classifies salary, refund, investment and other", () => {
    const result = aggregateIncomeComposition(incomeData);
    const labelFor = (b: string) => result.slices.find((s) => s.bucket === b);
    expect(labelFor("salary")?.amount).toBe(7000);
    expect(labelFor("refund")?.amount).toBe(80);
    expect(labelFor("investment")?.amount).toBe(60);
    expect(labelFor("other")?.amount).toBe(150);
  });

  it("provides monthly history of composition", () => {
    const result = aggregateIncomeComposition(incomeData);
    const april = result.history.find((p) => p.periodKey === "2026-04");
    expect(april?.salary).toBe(3500);
    expect(april?.refund).toBe(80);
    expect(april?.investment).toBe(60);
    expect(april?.other).toBe(150);
  });

  it("returns empty composition when no income", () => {
    const result = aggregateIncomeComposition([]);
    expect(result.slices).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe("aggregateSavingsRateOverTime", () => {
  const monthly: AnalysisTransaction[] = [
    { bookingDate: new Date("2026-01-25"), amount: 3000, direction: "INCOME", counterpartyName: "E" },
    { bookingDate: new Date("2026-01-10"), amount: -2400, direction: "EXPENSE", counterpartyName: "x" },
    { bookingDate: new Date("2026-02-25"), amount: 3000, direction: "INCOME", counterpartyName: "E" },
    { bookingDate: new Date("2026-02-10"), amount: -1500, direction: "EXPENSE", counterpartyName: "x" },
    { bookingDate: new Date("2026-03-25"), amount: 3000, direction: "INCOME", counterpartyName: "E" },
    { bookingDate: new Date("2026-03-10"), amount: -2700, direction: "EXPENSE", counterpartyName: "x" },
  ];

  it("computes monthly savings rate and rolling 3M average", () => {
    const points = aggregateSavingsRateOverTime(monthly);
    expect(points).toHaveLength(3);
    expect(points[0]?.savingsRate).toBeCloseTo(20, 2);
    expect(points[1]?.savingsRate).toBeCloseTo(50, 2);
    expect(points[2]?.savingsRate).toBeCloseTo(10, 2);
    expect(points[2]?.savingsRateAvg3).toBeCloseTo((20 + 50 + 10) / 3, 2);
    expect(points[0]?.savingsRateAvg3).toBeNull();
  });

  it("excludes internal transfers from savings rate", () => {
    const data: AnalysisTransaction[] = [
      ...monthly,
      {
        bookingDate: new Date("2026-03-15"),
        amount: -500,
        direction: "EXPENSE",
        counterpartyName: "self",
        isInternalTransfer: true,
      },
    ];
    const points = aggregateSavingsRateOverTime(data);
    expect(points[2]?.expenses).toBe(2700);
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
