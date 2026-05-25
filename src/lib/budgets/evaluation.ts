import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

import {
  currentPeriodBounds,
  effectiveCapForPeriod,
  spentForCategoryInPeriod,
  type BudgetTransaction,
  type CategoryNode,
} from "./aggregate";
import { crossedThresholds, DEFAULT_THRESHOLDS } from "./thresholds";
import type { BudgetPeriod } from "./period";

export type EvaluatedLimit = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  periodStart: Date;
  periodEnd: Date;
  baseLimit: number;
  effectiveLimit: number;
  spent: number;
  ratio: number;
  rollover: boolean;
  period: BudgetPeriod;
};

export async function evaluateHouseholdBudgets(args: {
  householdId: string;
  now?: Date;
}): Promise<{
  evaluations: EvaluatedLimit[];
  newAlertsCreated: number;
}> {
  const now = args.now ?? new Date();

  const categoriesWithLimits = await prisma.category.findMany({
    where: {
      householdId: args.householdId,
      isArchived: false,
      limitAmount: { not: null },
      limitPeriod: { not: null },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      limitAmount: true,
      limitPeriod: true,
      limitRollover: true,
    },
  });

  if (categoriesWithLimits.length === 0) {
    return { evaluations: [], newAlertsCreated: 0 };
  }

  const categoryTree: CategoryNode[] = await prisma.category
    .findMany({
      where: { householdId: args.householdId },
      select: { id: true, parentId: true },
    })
    .then((rows) => rows.map((r) => ({ id: r.id, parentId: r.parentId })));

  const transactions = await prisma.transaction
    .findMany({
      where: {
        householdId: args.householdId,
        isInternalTransfer: false,
        direction: "EXPENSE",
      },
      select: {
        bookingDate: true,
        amount: true,
        direction: true,
        isInternalTransfer: true,
        categoryId: true,
      },
    })
    .then((rows): BudgetTransaction[] =>
      rows.map((r) => ({
        bookingDate: r.bookingDate,
        amount: Number(r.amount),
        direction: r.direction,
        isInternalTransfer: r.isInternalTransfer,
        categoryId: r.categoryId,
      })),
    );

  const evaluations: EvaluatedLimit[] = [];
  let newAlertsCreated = 0;

  for (const category of categoriesWithLimits) {
    if (!category.limitPeriod || !category.limitAmount) continue;
    const period = category.limitPeriod;
    const bounds = currentPeriodBounds(period, now);
    const baseLimit = Number(category.limitAmount);
    const effectiveLimit = effectiveCapForPeriod({
      categoryId: category.id,
      baseLimit,
      rollover: category.limitRollover,
      period,
      currentBounds: bounds,
      transactions,
      categoryTree,
    });
    const spent = spentForCategoryInPeriod(
      category.id,
      transactions,
      bounds,
      categoryTree,
    );
    const ratio = effectiveLimit > 0 ? spent / effectiveLimit : 0;

    evaluations.push({
      categoryId: category.id,
      categoryName: category.name,
      categorySlug: category.slug,
      periodStart: bounds.start,
      periodEnd: bounds.end,
      baseLimit,
      effectiveLimit,
      spent,
      ratio,
      rollover: category.limitRollover,
      period,
    });

    const crossings = crossedThresholds(spent, effectiveLimit, DEFAULT_THRESHOLDS);
    for (const crossing of crossings) {
      const created = await upsertAlertOnce({
        categoryId: category.id,
        periodStart: bounds.start,
        periodEnd: bounds.end,
        threshold: crossing.threshold,
        spent,
        effectiveLimit,
      });
      if (created) newAlertsCreated += 1;
    }
  }

  return { evaluations, newAlertsCreated };
}

async function upsertAlertOnce(args: {
  categoryId: string;
  periodStart: Date;
  periodEnd: Date;
  threshold: number;
  spent: number;
  effectiveLimit: number;
}): Promise<boolean> {
  try {
    await prisma.categoryLimitAlert.create({
      data: {
        categoryId: args.categoryId,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        threshold: args.threshold,
        spentAmount: args.spent,
        limitAmount: args.effectiveLimit,
      },
    });
    return true;
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return false;
    }
    throw error;
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

export async function listUnacknowledgedAlerts(householdId: string) {
  return prisma.categoryLimitAlert.findMany({
    where: {
      acknowledgedAt: null,
      category: { householdId },
    },
    orderBy: [{ triggeredAt: "desc" }],
    select: {
      id: true,
      categoryId: true,
      periodStart: true,
      periodEnd: true,
      threshold: true,
      spentAmount: true,
      limitAmount: true,
      triggeredAt: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function acknowledgeAlertsForHousehold(args: {
  householdId: string;
  alertIds?: string[];
}): Promise<number> {
  const where: Prisma.CategoryLimitAlertWhereInput = {
    acknowledgedAt: null,
    category: { householdId: args.householdId },
  };
  if (args.alertIds?.length) where.id = { in: args.alertIds };

  const result = await prisma.categoryLimitAlert.updateMany({
    where,
    data: { acknowledgedAt: new Date() },
  });
  return result.count;
}
