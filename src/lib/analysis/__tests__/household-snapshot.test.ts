import { describe, expect, it } from "vitest";

import { buildHouseholdSnapshot } from "../household-snapshot";

describe("buildHouseholdSnapshot", () => {
  it("computes month totals, responsibility split and top categories", () => {
    const snapshot = buildHouseholdSnapshot(
      [
        {
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
});
