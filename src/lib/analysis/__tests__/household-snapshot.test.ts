import { describe, expect, it } from "vitest";

import { buildHouseholdSnapshot } from "../household-snapshot";

const baseRow = {
  isInternalTransfer: false,
} as const;

describe("buildHouseholdSnapshot", () => {
  it("computes month totals, responsibility split and top categories", () => {
    const snapshot = buildHouseholdSnapshot(
      [
        {
          ...baseRow,
          id: "txn-1",
          bookingDate: new Date("2026-05-02"),
          amount: 3200,
          direction: "INCOME",
          categoryName: "Salary",
          responsibilityType: "USER",
          accountName: "Gemeinschaftskonto",
          purposeRaw: "Salary May",
          counterpartyName: "Employer",
        },
        {
          ...baseRow,
          id: "txn-2",
          bookingDate: new Date("2026-05-03"),
          amount: -80,
          direction: "EXPENSE",
          categoryName: "Groceries",
          responsibilityType: "SHARED",
          accountName: "Gemeinschaftskonto",
          purposeRaw: "Weekly groceries",
          counterpartyName: "REWE",
        },
        {
          ...baseRow,
          id: "txn-3",
          bookingDate: new Date("2026-05-04"),
          amount: -45,
          direction: "EXPENSE",
          categoryName: null,
          responsibilityType: "USER",
          accountName: "Hendrik Privat",
          purposeRaw: "Book order",
          counterpartyName: "Thalia",
        },
        {
          ...baseRow,
          id: "txn-old",
          bookingDate: new Date("2026-04-20"),
          amount: -999,
          direction: "EXPENSE",
          categoryName: "Ignored",
          responsibilityType: "SHARED",
          accountName: "Old",
          purposeRaw: "Old month",
          counterpartyName: "Old merchant",
        },
      ],
      new Date("2026-05-18T12:00:00Z"),
    );

    expect(snapshot.monthIncome).toBe(3200);
    expect(snapshot.monthExpenses).toBe(125);
    expect(snapshot.monthNet).toBe(3075);
    expect(snapshot.uncategorizedCount).toBe(1);
    expect(snapshot.sharedExpenses).toBe(80);
    expect(snapshot.personalExpenses).toBe(45);
    expect(snapshot.topCategories[0]).toEqual({ name: "Groceries", amount: 80 });
    expect(snapshot.topCategories[1]).toEqual({ name: "Uncategorized", amount: 45 });
    expect(snapshot.recentTransactions).toHaveLength(3);
  });

  it("excludes internal transfers from income, expenses, responsibility split, and top categories", () => {
    const snapshot = buildHouseholdSnapshot(
      [
        {
          ...baseRow,
          id: "txn-salary",
          bookingDate: new Date("2026-05-02"),
          amount: 3200,
          direction: "INCOME",
          categoryName: "Salary",
          responsibilityType: "USER",
          accountName: "Giro",
          purposeRaw: "Gehalt",
          counterpartyName: "Employer",
        },
        {
          ...baseRow,
          id: "txn-transfer-out",
          bookingDate: new Date("2026-05-03"),
          amount: -500,
          direction: "EXPENSE",
          categoryName: "Transfer",
          responsibilityType: "USER",
          accountName: "Giro",
          purposeRaw: "Sparen",
          counterpartyName: "Hendrik Sparkonto",
          isInternalTransfer: true,
        },
        {
          ...baseRow,
          id: "txn-transfer-in",
          bookingDate: new Date("2026-05-03"),
          amount: 500,
          direction: "INCOME",
          categoryName: "Transfer",
          responsibilityType: "USER",
          accountName: "Sparkonto",
          purposeRaw: "Sparen",
          counterpartyName: "Hendrik Giro",
          isInternalTransfer: true,
        },
        {
          ...baseRow,
          id: "txn-groceries",
          bookingDate: new Date("2026-05-04"),
          amount: -80,
          direction: "EXPENSE",
          categoryName: "Groceries",
          responsibilityType: "SHARED",
          accountName: "Giro",
          purposeRaw: "Wocheneinkauf",
          counterpartyName: "REWE",
        },
      ],
      new Date("2026-05-18T12:00:00Z"),
    );

    expect(snapshot.monthIncome).toBe(3200);
    expect(snapshot.monthExpenses).toBe(80);
    expect(snapshot.monthNet).toBe(3120);
    expect(snapshot.transferVolume).toBe(1000);
    expect(snapshot.sharedExpenses).toBe(80);
    expect(snapshot.personalExpenses).toBe(0);
    expect(snapshot.topCategories.map((c) => c.name)).not.toContain("Transfer");
  });

  it("surfaces the partial-month range when today is before month end", () => {
    const snapshot = buildHouseholdSnapshot([], new Date("2026-05-18T12:00:00Z"));

    expect(snapshot.monthRangeStart.toISOString().slice(0, 10)).toBe("2026-05-01");
    expect(snapshot.monthRangeEnd.toISOString().slice(0, 10)).toBe("2026-05-18");
    expect(snapshot.isPartialMonth).toBe(true);
  });

  it("uses the full month range on the last day", () => {
    const snapshot = buildHouseholdSnapshot([], new Date("2026-05-31T23:00:00Z"));

    expect(snapshot.monthRangeEnd.toISOString().slice(0, 10)).toBe("2026-05-31");
    expect(snapshot.isPartialMonth).toBe(false);
  });
});
