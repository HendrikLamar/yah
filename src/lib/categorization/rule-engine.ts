import { prisma } from "@/lib/db/prisma";

export type RuleInput = {
  id: string;
  name: string;
  priority: number;
  isEnabled: boolean;
  matchField:
    | "PURPOSE_RAW"
    | "COUNTERPARTY_NAME"
    | "NORMALIZED_MERCHANT"
    | "AMOUNT"
    | "DIRECTION"
    | "ACCOUNT_ID";
  matchOperator:
    | "CONTAINS"
    | "EQUALS"
    | "REGEX"
    | "STARTS_WITH"
    | "AMOUNT_GT"
    | "AMOUNT_LT";
  matchValue: string;
  accountId: string | null;
  actionCategoryId: string | null;
  actionResponsibilityType: "SHARED" | "USER" | null;
  actionResponsibilityUserId: string | null;
  actionMarkTransfer: boolean;
};

export type TransactionForRules = {
  purposeRaw: string;
  counterpartyName: string | null;
  normalizedMerchant: string | null;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  accountId: string;
};

export type RuleOutcome = {
  categoryId: string | null;
  responsibilityType: "SHARED" | "USER" | null;
  responsibilityUserId: string | null;
  isInternalTransfer: boolean;
  matchedRuleId: string | null;
};

const EMPTY_OUTCOME: RuleOutcome = {
  categoryId: null,
  responsibilityType: null,
  responsibilityUserId: null,
  isInternalTransfer: false,
  matchedRuleId: null,
};

export function applyRulesToTransaction(
  rules: RuleInput[],
  transaction: TransactionForRules,
): RuleOutcome {
  const ordered = [...rules]
    .filter((rule) => rule.isEnabled)
    .sort((left, right) => left.priority - right.priority);

  for (const rule of ordered) {
    if (rule.accountId && rule.accountId !== transaction.accountId) {
      continue;
    }

    if (!matches(rule, transaction)) {
      continue;
    }

    return {
      categoryId: rule.actionCategoryId,
      responsibilityType: rule.actionResponsibilityType,
      responsibilityUserId: rule.actionResponsibilityUserId,
      isInternalTransfer: rule.actionMarkTransfer,
      matchedRuleId: rule.id,
    };
  }

  return EMPTY_OUTCOME;
}

function matches(rule: RuleInput, transaction: TransactionForRules): boolean {
  const { matchField, matchOperator, matchValue } = rule;

  if (matchOperator === "AMOUNT_GT" || matchOperator === "AMOUNT_LT") {
    const threshold = Number(matchValue);
    if (Number.isNaN(threshold)) return false;
    const value = matchField === "AMOUNT" ? transaction.amount : Number.NaN;
    if (Number.isNaN(value)) return false;
    return matchOperator === "AMOUNT_GT" ? value > threshold : value < threshold;
  }

  const haystack = readField(matchField, transaction);
  if (haystack === null) return false;

  switch (matchOperator) {
    case "CONTAINS":
      return haystack.toLowerCase().includes(matchValue.toLowerCase());
    case "EQUALS":
      return haystack.toLowerCase() === matchValue.toLowerCase();
    case "STARTS_WITH":
      return haystack.toLowerCase().startsWith(matchValue.toLowerCase());
    case "REGEX":
      try {
        const re = new RegExp(matchValue, "i");
        return re.test(haystack);
      } catch (error) {
        console.error(`[rule-engine] malformed regex in rule ${rule.id}`, error);
        return false;
      }
    default:
      return false;
  }
}

function readField(
  field: RuleInput["matchField"],
  transaction: TransactionForRules,
): string | null {
  switch (field) {
    case "PURPOSE_RAW":
      return transaction.purposeRaw;
    case "COUNTERPARTY_NAME":
      return transaction.counterpartyName;
    case "NORMALIZED_MERCHANT":
      return transaction.normalizedMerchant;
    case "ACCOUNT_ID":
      return transaction.accountId;
    case "DIRECTION":
      return transaction.direction;
    case "AMOUNT":
      return String(transaction.amount);
    default:
      return null;
  }
}

export async function fetchHouseholdRules(householdId: string): Promise<RuleInput[]> {
  const rules = await prisma.categorizationRule.findMany({
    where: { householdId, isEnabled: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  return rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    priority: rule.priority,
    isEnabled: rule.isEnabled,
    matchField: rule.matchField,
    matchOperator: rule.matchOperator,
    matchValue: rule.matchValue,
    accountId: rule.accountId,
    actionCategoryId: rule.actionCategoryId,
    actionResponsibilityType: rule.actionResponsibilityType,
    actionResponsibilityUserId: rule.actionResponsibilityUserId,
    actionMarkTransfer: rule.actionMarkTransfer,
  }));
}

export async function applyRulesToHousehold(options: {
  householdId: string;
  onlyUncategorized?: boolean;
  ruleId?: string;
}): Promise<{ matched: number; updated: number }> {
  const ruleFilter = options.ruleId
    ? { id: options.ruleId, householdId: options.householdId }
    : { householdId: options.householdId, isEnabled: true };

  const rules = (await prisma.categorizationRule.findMany({
    where: ruleFilter,
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  })).map((rule) => ({
    id: rule.id,
    name: rule.name,
    priority: rule.priority,
    isEnabled: rule.isEnabled,
    matchField: rule.matchField,
    matchOperator: rule.matchOperator,
    matchValue: rule.matchValue,
    accountId: rule.accountId,
    actionCategoryId: rule.actionCategoryId,
    actionResponsibilityType: rule.actionResponsibilityType,
    actionResponsibilityUserId: rule.actionResponsibilityUserId,
    actionMarkTransfer: rule.actionMarkTransfer,
  }));

  if (rules.length === 0) {
    return { matched: 0, updated: 0 };
  }

  const uncategorized = options.onlyUncategorized
    ? await prisma.category.findUnique({
        where: { householdId_slug: { householdId: options.householdId, slug: "uncategorized" } },
        select: { id: true },
      })
    : null;

  if (options.onlyUncategorized && !uncategorized) {
    return { matched: 0, updated: 0 };
  }

  const where = uncategorized
    ? { householdId: options.householdId, categoryId: uncategorized.id }
    : { householdId: options.householdId };

  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      id: true,
      purposeRaw: true,
      counterpartyName: true,
      normalizedMerchant: true,
      amount: true,
      direction: true,
      accountId: true,
    },
  });

  let matched = 0;
  let updated = 0;

  for (const transaction of transactions) {
    const outcome = applyRulesToTransaction(rules, {
      purposeRaw: transaction.purposeRaw,
      counterpartyName: transaction.counterpartyName,
      normalizedMerchant: transaction.normalizedMerchant,
      amount: Number(transaction.amount),
      direction: transaction.direction,
      accountId: transaction.accountId,
    });

    if (!outcome.matchedRuleId) continue;
    matched += 1;

    const data: Record<string, unknown> = {};
    if (outcome.categoryId) data.categoryId = outcome.categoryId;
    if (outcome.responsibilityType) data.responsibilityType = outcome.responsibilityType;
    if (outcome.responsibilityUserId !== null)
      data.responsibilityUserId = outcome.responsibilityUserId;
    if (outcome.isInternalTransfer) data.isInternalTransfer = true;

    if (Object.keys(data).length === 0) continue;

    await prisma.transaction.update({ where: { id: transaction.id }, data });
    updated += 1;
  }

  return { matched, updated };
}
