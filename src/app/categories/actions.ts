"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  acknowledgeAlertsForHousehold,
  evaluateHouseholdBudgets,
} from "@/lib/budgets/evaluation";
import { prisma } from "@/lib/db/prisma";
import { getViewerHouseholdContext } from "@/lib/household/viewer";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function redirectWithMessage(message: string, error = false): never {
  const key = error ? "error" : "ok";
  redirect(`/categories?${key}=${encodeURIComponent(message)}`);
}

function parseLimit(formData: FormData): {
  limitAmount: number | null;
  limitPeriod: "MONTHLY" | "QUARTERLY" | "YEARLY" | null;
  limitRollover: boolean;
} {
  const raw = String(formData.get("limitAmount") ?? "").trim();
  const periodRaw = String(formData.get("limitPeriod") ?? "").trim();
  const rolloverRaw = formData.get("limitRollover");

  if (!raw) {
    return { limitAmount: null, limitPeriod: null, limitRollover: false };
  }
  const amount = Number(raw.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    redirectWithMessage("Budget muss eine positive Zahl sein.", true);
  }
  if (periodRaw !== "MONTHLY" && periodRaw !== "QUARTERLY" && periodRaw !== "YEARLY") {
    redirectWithMessage("Budget braucht einen Zeitraum.", true);
  }
  return {
    limitAmount: amount,
    limitPeriod: periodRaw as "MONTHLY" | "QUARTERLY" | "YEARLY",
    limitRollover: rolloverRaw === "on" || rolloverRaw === "true",
  };
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  const context = await getViewerHouseholdContext();
  const name = String(formData.get("name") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "EXPENSE").trim();
  const color = String(formData.get("color") ?? "").trim() || null;
  const parentRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentRaw === "" || parentRaw === "none" ? null : parentRaw;
  const kind = kindRaw === "INCOME" || kindRaw === "TRANSFER" ? kindRaw : "EXPENSE";

  if (!name) redirectWithMessage("Name darf nicht leer sein.", true);

  const slug = slugify(name);
  if (!slug) redirectWithMessage("Name muss aussprechbare Zeichen enthalten.", true);

  const existing = await prisma.category.findFirst({
    where: { householdId: context.householdId, slug },
    select: { id: true },
  });
  if (existing) {
    redirectWithMessage("Slug existiert bereits — anderen Namen wählen.", true);
  }

  const limit = parseLimit(formData);

  await prisma.category.create({
    data: {
      householdId: context.householdId,
      name,
      slug,
      kind,
      color,
      parentId,
      limitAmount: limit.limitAmount,
      limitPeriod: limit.limitPeriod,
      limitRollover: limit.limitRollover,
      isSystem: false,
    },
  });

  await evaluateHouseholdBudgets({ householdId: context.householdId });

  revalidatePath("/categories");
  revalidatePath("/dashboard");
  redirectWithMessage("Kategorie angelegt.");
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  const context = await getViewerHouseholdContext();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirectWithMessage("Kategorie nicht gefunden.", true);

  const existing = await prisma.category.findFirst({
    where: { id, householdId: context.householdId },
    select: { id: true, isSystem: true, slug: true, kind: true },
  });
  if (!existing) redirectWithMessage("Kategorie nicht gefunden.", true);

  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim() || null;
  const parentRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentRaw === "" || parentRaw === "none" ? null : parentRaw;
  const archive = formData.get("archive");
  const limit = parseLimit(formData);

  const data: {
    name?: string;
    color?: string | null;
    parentId?: string | null;
    limitAmount?: number | null;
    limitPeriod?: "MONTHLY" | "QUARTERLY" | "YEARLY" | null;
    limitRollover?: boolean;
    isArchived?: boolean;
  } = {
    color,
    parentId: parentId === id ? null : parentId,
    limitAmount: limit.limitAmount,
    limitPeriod: limit.limitPeriod,
    limitRollover: limit.limitRollover,
  };

  if (!existing.isSystem) {
    if (!name) redirectWithMessage("Name darf nicht leer sein.", true);
    data.name = name;
  }

  if (archive !== null) {
    data.isArchived = archive === "true" || archive === "on";
  }

  await prisma.category.update({ where: { id }, data });

  await evaluateHouseholdBudgets({ householdId: context.householdId });

  revalidatePath("/categories");
  revalidatePath("/dashboard");
  redirectWithMessage("Kategorie aktualisiert.");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const context = await getViewerHouseholdContext();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirectWithMessage("Kategorie nicht gefunden.", true);

  const cat = await prisma.category.findFirst({
    where: { id, householdId: context.householdId },
    include: { _count: { select: { transactions: true, rules: true } } },
  });
  if (!cat) redirectWithMessage("Kategorie nicht gefunden.", true);
  if (cat.isSystem) {
    redirectWithMessage("Systemkategorien können nicht gelöscht werden — archiviere sie.", true);
  }
  if (cat._count.transactions > 0 || cat._count.rules > 0) {
    redirectWithMessage("Kategorie ist noch in Verwendung — archivieren statt löschen.", true);
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath("/categories");
  revalidatePath("/dashboard");
  redirectWithMessage("Kategorie gelöscht.");
}

export async function acknowledgeAlertsAction(formData: FormData): Promise<void> {
  const context = await getViewerHouseholdContext();
  const alertIds = formData.getAll("alertId").map(String).filter(Boolean);
  await acknowledgeAlertsForHousehold({
    householdId: context.householdId,
    alertIds: alertIds.length ? alertIds : undefined,
  });
  revalidatePath("/categories");
  revalidatePath("/dashboard");
}
