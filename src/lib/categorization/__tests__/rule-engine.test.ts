import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    categorizationRule: { findMany: vi.fn() },
    transaction: { findMany: vi.fn(), update: vi.fn() },
    category: { findUnique: vi.fn() },
  },
}));

import { applyRulesToTransaction, type RuleInput, type TransactionForRules } from "../rule-engine";

const baseRule: RuleInput = {
  id: "rule-base",
  name: "base",
  priority: 100,
  isEnabled: true,
  matchField: "PURPOSE_RAW",
  matchOperator: "CONTAINS",
  matchValue: "REWE",
  accountId: null,
  actionCategoryId: "cat-groceries",
  actionResponsibilityType: null,
  actionResponsibilityUserId: null,
  actionMarkTransfer: false,
};

const baseTxn: TransactionForRules = {
  purposeRaw: "REWE BERLIN Wocheneinkauf",
  counterpartyName: "REWE BERLIN",
  normalizedMerchant: null,
  amount: -42.5,
  direction: "EXPENSE",
  accountId: "account-1",
};

describe("applyRulesToTransaction", () => {
  it("matches via CONTAINS, case-insensitive, on PURPOSE_RAW", () => {
    const outcome = applyRulesToTransaction([baseRule], baseTxn);
    expect(outcome.categoryId).toBe("cat-groceries");
    expect(outcome.matchedRuleId).toBe("rule-base");
  });

  it("returns empty outcome when no rules match", () => {
    const outcome = applyRulesToTransaction(
      [{ ...baseRule, matchValue: "ALDI" }],
      baseTxn,
    );
    expect(outcome.matchedRuleId).toBeNull();
    expect(outcome.categoryId).toBeNull();
  });

  it("honours priority order (lower wins)", () => {
    const winner: RuleInput = {
      ...baseRule,
      id: "rule-winner",
      priority: 10,
      actionCategoryId: "cat-winner",
    };
    const loser: RuleInput = {
      ...baseRule,
      id: "rule-loser",
      priority: 100,
      actionCategoryId: "cat-loser",
    };
    const outcome = applyRulesToTransaction([loser, winner], baseTxn);
    expect(outcome.matchedRuleId).toBe("rule-winner");
    expect(outcome.categoryId).toBe("cat-winner");
  });

  it("skips disabled rules", () => {
    const outcome = applyRulesToTransaction(
      [{ ...baseRule, isEnabled: false }],
      baseTxn,
    );
    expect(outcome.matchedRuleId).toBeNull();
  });

  it("honours account scope when set", () => {
    const scoped: RuleInput = { ...baseRule, accountId: "account-other" };
    expect(applyRulesToTransaction([scoped], baseTxn).matchedRuleId).toBeNull();
    expect(
      applyRulesToTransaction([{ ...scoped, accountId: "account-1" }], baseTxn)
        .matchedRuleId,
    ).toBe("rule-base");
  });

  it("supports EQUALS, STARTS_WITH, REGEX operators", () => {
    expect(
      applyRulesToTransaction(
        [{ ...baseRule, matchOperator: "EQUALS", matchValue: "REWE BERLIN" }],
        { ...baseTxn, purposeRaw: "REWE BERLIN" },
      ).matchedRuleId,
    ).toBe("rule-base");

    expect(
      applyRulesToTransaction(
        [{ ...baseRule, matchOperator: "STARTS_WITH", matchValue: "rewe" }],
        baseTxn,
      ).matchedRuleId,
    ).toBe("rule-base");

    expect(
      applyRulesToTransaction(
        [{ ...baseRule, matchOperator: "REGEX", matchValue: "^REWE\\s+BERLIN" }],
        baseTxn,
      ).matchedRuleId,
    ).toBe("rule-base");
  });

  it("tolerates malformed regex by skipping the rule", () => {
    const malformed: RuleInput = {
      ...baseRule,
      id: "rule-bad",
      matchOperator: "REGEX",
      matchValue: "[unclosed",
    };
    const fallback: RuleInput = {
      ...baseRule,
      id: "rule-fallback",
      priority: 200,
      actionCategoryId: "cat-fallback",
    };
    const outcome = applyRulesToTransaction([malformed, fallback], baseTxn);
    expect(outcome.matchedRuleId).toBe("rule-fallback");
    expect(outcome.categoryId).toBe("cat-fallback");
  });

  it("supports AMOUNT_GT and AMOUNT_LT", () => {
    expect(
      applyRulesToTransaction(
        [
          {
            ...baseRule,
            matchField: "AMOUNT",
            matchOperator: "AMOUNT_GT",
            matchValue: "100",
          },
        ],
        { ...baseTxn, amount: 150 },
      ).matchedRuleId,
    ).toBe("rule-base");

    expect(
      applyRulesToTransaction(
        [
          {
            ...baseRule,
            matchField: "AMOUNT",
            matchOperator: "AMOUNT_LT",
            matchValue: "-100",
          },
        ],
        { ...baseTxn, amount: -200 },
      ).matchedRuleId,
    ).toBe("rule-base");
  });

  it("can flag transactions as internal transfers via actionMarkTransfer", () => {
    const outcome = applyRulesToTransaction(
      [
        {
          ...baseRule,
          matchField: "COUNTERPARTY_NAME",
          matchOperator: "CONTAINS",
          matchValue: "Hendrik Sparkonto",
          actionCategoryId: null,
          actionMarkTransfer: true,
        },
      ],
      { ...baseTxn, counterpartyName: "HENDRIK SPARKONTO" },
    );
    expect(outcome.isInternalTransfer).toBe(true);
  });
});
