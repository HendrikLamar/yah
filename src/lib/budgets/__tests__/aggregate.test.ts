import { describe, expect, it } from "vitest";

import {
  collectDescendants,
  effectiveCapForPeriod,
  spentForCategoryInPeriod,
  type BudgetTransaction,
  type CategoryNode,
} from "../aggregate";
import { periodBoundsForDate } from "../period";

const tree: CategoryNode[] = [
  { id: "food", parentId: null },
  { id: "groceries", parentId: "food" },
  { id: "restaurant", parentId: "food" },
  { id: "fast-food", parentId: "restaurant" },
  { id: "rent", parentId: null },
];

describe("collectDescendants", () => {
  it("returns the root + every descendant in the tree", () => {
    const result = collectDescendants("food", tree);
    expect(result).toEqual(new Set(["food", "groceries", "restaurant", "fast-food"]));
  });

  it("returns just the node for a leaf", () => {
    expect(collectDescendants("rent", tree)).toEqual(new Set(["rent"]));
  });
});

describe("spentForCategoryInPeriod", () => {
  const transactions: BudgetTransaction[] = [
    {
      bookingDate: new Date("2026-03-05"),
      amount: -50,
      direction: "EXPENSE",
      isInternalTransfer: false,
      categoryId: "groceries",
    },
    {
      bookingDate: new Date("2026-03-20"),
      amount: -30,
      direction: "EXPENSE",
      isInternalTransfer: false,
      categoryId: "fast-food",
    },
    {
      bookingDate: new Date("2026-03-22"),
      amount: -800,
      direction: "EXPENSE",
      isInternalTransfer: false,
      categoryId: "rent",
    },
    {
      bookingDate: new Date("2026-03-25"),
      amount: -200,
      direction: "EXPENSE",
      isInternalTransfer: true,
      categoryId: "groceries",
    },
    {
      bookingDate: new Date("2026-04-02"),
      amount: -60,
      direction: "EXPENSE",
      isInternalTransfer: false,
      categoryId: "groceries",
    },
    {
      bookingDate: new Date("2026-03-10"),
      amount: 3000,
      direction: "INCOME",
      isInternalTransfer: false,
      categoryId: "groceries",
    },
  ];

  const march = periodBoundsForDate("MONTHLY", new Date("2026-03-15Z"));

  it("rolls up child spend into the parent category", () => {
    expect(spentForCategoryInPeriod("food", transactions, march, tree)).toBe(80);
  });

  it("excludes income, transfers, and out-of-period rows", () => {
    expect(spentForCategoryInPeriod("groceries", transactions, march, tree)).toBe(50);
  });

  it("returns 0 when nothing matches", () => {
    expect(
      spentForCategoryInPeriod("rent", transactions, periodBoundsForDate("MONTHLY", new Date("2026-04-15Z")), tree),
    ).toBe(0);
  });
});

describe("effectiveCapForPeriod", () => {
  const transactions: BudgetTransaction[] = [
    // February: spent 60 of 100 → leftover 40
    {
      bookingDate: new Date("2026-02-15"),
      amount: -60,
      direction: "EXPENSE",
      isInternalTransfer: false,
      categoryId: "groceries",
    },
  ];

  it("returns the base limit when rollover is off", () => {
    const march = periodBoundsForDate("MONTHLY", new Date("2026-03-15Z"));
    const cap = effectiveCapForPeriod({
      categoryId: "groceries",
      baseLimit: 100,
      rollover: false,
      period: "MONTHLY",
      currentBounds: march,
      transactions,
      categoryTree: tree,
    });
    expect(cap).toBe(100);
  });

  it("adds prior-period leftover when rollover is on", () => {
    const march = periodBoundsForDate("MONTHLY", new Date("2026-03-15Z"));
    const cap = effectiveCapForPeriod({
      categoryId: "groceries",
      baseLimit: 100,
      rollover: true,
      period: "MONTHLY",
      currentBounds: march,
      transactions,
      categoryTree: tree,
    });
    expect(cap).toBe(140);
  });

  it("never goes below the base limit when prior period was over budget", () => {
    const overTx: BudgetTransaction[] = [
      {
        bookingDate: new Date("2026-02-15"),
        amount: -200,
        direction: "EXPENSE",
        isInternalTransfer: false,
        categoryId: "groceries",
      },
    ];
    const march = periodBoundsForDate("MONTHLY", new Date("2026-03-15Z"));
    const cap = effectiveCapForPeriod({
      categoryId: "groceries",
      baseLimit: 100,
      rollover: true,
      period: "MONTHLY",
      currentBounds: march,
      transactions: overTx,
      categoryTree: tree,
    });
    expect(cap).toBe(100);
  });
});
