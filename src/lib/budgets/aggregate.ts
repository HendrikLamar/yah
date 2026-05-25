import { isWithin, periodBoundsForDate, previousPeriod, type BudgetPeriod, type PeriodBounds } from "./period";

export type BudgetTransaction = {
  bookingDate: Date;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  isInternalTransfer: boolean;
  categoryId: string | null;
};

export type CategoryNode = {
  id: string;
  parentId: string | null;
};

/**
 * Returns the effective spent amount for a category (own + descendants),
 * counting only non-transfer EXPENSE rows inside the period.
 */
export function spentForCategoryInPeriod(
  categoryId: string,
  transactions: BudgetTransaction[],
  bounds: PeriodBounds,
  categoryTree: CategoryNode[],
): number {
  const descendants = collectDescendants(categoryId, categoryTree);
  let total = 0;
  for (const t of transactions) {
    if (t.isInternalTransfer) continue;
    if (t.direction !== "EXPENSE") continue;
    if (!t.categoryId || !descendants.has(t.categoryId)) continue;
    if (!isWithin(t.bookingDate, bounds)) continue;
    total += Math.abs(t.amount);
  }
  return total;
}

export function collectDescendants(
  rootId: string,
  categoryTree: CategoryNode[],
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const node of categoryTree) {
    if (!node.parentId) continue;
    const arr = childrenByParent.get(node.parentId) ?? [];
    arr.push(node.id);
    childrenByParent.set(node.parentId, arr);
  }
  const result = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const next = stack.pop();
    if (!next) continue;
    const children = childrenByParent.get(next) ?? [];
    for (const child of children) {
      if (!result.has(child)) {
        result.add(child);
        stack.push(child);
      }
    }
  }
  return result;
}

/**
 * Effective cap for the period. With rollover, the prior period's leftover
 * (max(0, prevCap - prevSpent)) carries forward; without, each period stands
 * alone.
 */
export function effectiveCapForPeriod(args: {
  categoryId: string;
  baseLimit: number;
  rollover: boolean;
  period: BudgetPeriod;
  currentBounds: PeriodBounds;
  transactions: BudgetTransaction[];
  categoryTree: CategoryNode[];
}): number {
  if (!args.rollover) return args.baseLimit;
  const prev = previousPeriod(args.period, args.currentBounds);
  const prevSpent = spentForCategoryInPeriod(
    args.categoryId,
    args.transactions,
    prev,
    args.categoryTree,
  );
  const leftover = Math.max(0, args.baseLimit - prevSpent);
  return args.baseLimit + leftover;
}

export function currentPeriodBounds(period: BudgetPeriod, now: Date = new Date()): PeriodBounds {
  return periodBoundsForDate(period, now);
}
