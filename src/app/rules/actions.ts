"use server";

import { redirect } from "next/navigation";

import { applyRulesToHousehold } from "@/lib/categorization/rule-engine";
import { prisma } from "@/lib/db/prisma";
import { getViewerHouseholdContext } from "@/lib/household/viewer";

type MatchField =
  | "PURPOSE_RAW"
  | "COUNTERPARTY_NAME"
  | "NORMALIZED_MERCHANT"
  | "AMOUNT"
  | "DIRECTION"
  | "ACCOUNT_ID";

type MatchOperator =
  | "CONTAINS"
  | "EQUALS"
  | "REGEX"
  | "STARTS_WITH"
  | "AMOUNT_GT"
  | "AMOUNT_LT";

const ALL_MATCH_FIELDS: MatchField[] = [
  "PURPOSE_RAW",
  "COUNTERPARTY_NAME",
  "NORMALIZED_MERCHANT",
  "AMOUNT",
  "DIRECTION",
  "ACCOUNT_ID",
];
const ALL_MATCH_OPERATORS: MatchOperator[] = [
  "CONTAINS",
  "EQUALS",
  "REGEX",
  "STARTS_WITH",
  "AMOUNT_GT",
  "AMOUNT_LT",
];

function redirectWithError(message: string): never {
  redirect(`/rules?error=${encodeURIComponent(message)}`);
}

type ParsedRule = {
  name: string;
  priority: number;
  matchField: MatchField;
  matchOperator: MatchOperator;
  matchValue: string;
  actionCategoryId: string | null;
  actionResponsibilityType: "SHARED" | "USER" | null;
  actionMarkTransfer: boolean;
  accountId: string | null;
};

function parseRuleForm(formData: FormData): ParsedRule {
  const name = String(formData.get("name") ?? "").trim();
  const priorityRaw = String(formData.get("priority") ?? "100").trim();
  const matchField = String(formData.get("matchField") ?? "") as MatchField;
  const matchOperator = String(formData.get("matchOperator") ?? "") as MatchOperator;
  const matchValue = String(formData.get("matchValue") ?? "").trim();
  const actionCategoryId = String(formData.get("actionCategoryId") ?? "").trim();
  const actionResponsibilityType = String(formData.get("actionResponsibilityType") ?? "").trim();
  const actionMarkTransfer = formData.get("actionMarkTransfer") === "on";
  const accountId = String(formData.get("accountId") ?? "").trim();

  const priority = Number(priorityRaw);

  if (!name) redirectWithError("Regelname fehlt.");
  if (!ALL_MATCH_FIELDS.includes(matchField)) redirectWithError("Ungültiges Feld.");
  if (!ALL_MATCH_OPERATORS.includes(matchOperator)) redirectWithError("Ungültiger Operator.");
  if (!matchValue) redirectWithError("Vergleichswert fehlt.");
  if (Number.isNaN(priority)) redirectWithError("Priorität muss eine Zahl sein.");

  if (matchOperator === "REGEX") {
    try {
      new RegExp(matchValue, "i");
    } catch {
      redirectWithError("Regex ist ungültig.");
    }
  }

  return {
    name,
    priority,
    matchField,
    matchOperator,
    matchValue,
    actionCategoryId: actionCategoryId || null,
    actionResponsibilityType:
      actionResponsibilityType === "SHARED" || actionResponsibilityType === "USER"
        ? actionResponsibilityType
        : null,
    actionMarkTransfer,
    accountId: accountId || null,
  };
}

export async function createRuleAction(formData: FormData) {
  const context = await getViewerHouseholdContext();
  if (!context.viewer) redirect("/settings?error=Bitte+einloggen");

  const data = parseRuleForm(formData);

  await prisma.categorizationRule.create({
    data: {
      householdId: context.householdId,
      name: data.name,
      priority: data.priority,
      isEnabled: true,
      matchField: data.matchField,
      matchOperator: data.matchOperator,
      matchValue: data.matchValue,
      actionCategoryId: data.actionCategoryId,
      actionResponsibilityType: data.actionResponsibilityType,
      actionMarkTransfer: data.actionMarkTransfer,
      accountId: data.accountId,
      createdByUserId: context.viewer.userId,
    },
  });

  redirect("/rules?created=1");
}

export async function updateRuleAction(formData: FormData) {
  const context = await getViewerHouseholdContext();
  if (!context.viewer) redirect("/settings?error=Bitte+einloggen");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirectWithError("Regel-ID fehlt.");

  const existing = await prisma.categorizationRule.findFirst({
    where: { id, householdId: context.householdId },
    select: { id: true },
  });
  if (!existing) redirectWithError("Regel nicht gefunden.");

  const data = parseRuleForm(formData);

  await prisma.categorizationRule.update({
    where: { id },
    data: {
      name: data.name,
      priority: data.priority,
      matchField: data.matchField,
      matchOperator: data.matchOperator,
      matchValue: data.matchValue,
      actionCategoryId: data.actionCategoryId,
      actionResponsibilityType: data.actionResponsibilityType,
      actionMarkTransfer: data.actionMarkTransfer,
      accountId: data.accountId,
    },
  });

  redirect("/rules?updated=1");
}

export async function toggleRuleAction(formData: FormData) {
  const context = await getViewerHouseholdContext();
  if (!context.viewer) redirect("/settings?error=Bitte+einloggen");

  const id = String(formData.get("id") ?? "").trim();
  const enable = formData.get("enable") === "true";

  const existing = await prisma.categorizationRule.findFirst({
    where: { id, householdId: context.householdId },
    select: { id: true },
  });
  if (!existing) redirectWithError("Regel nicht gefunden.");

  await prisma.categorizationRule.update({
    where: { id },
    data: { isEnabled: enable },
  });

  redirect("/rules?updated=1");
}

export async function deleteRuleAction(formData: FormData) {
  const context = await getViewerHouseholdContext();
  if (!context.viewer) redirect("/settings?error=Bitte+einloggen");

  const id = String(formData.get("id") ?? "").trim();

  const existing = await prisma.categorizationRule.findFirst({
    where: { id, householdId: context.householdId },
    select: { id: true },
  });
  if (!existing) redirectWithError("Regel nicht gefunden.");

  await prisma.categorizationRule.delete({ where: { id } });
  redirect("/rules?deleted=1");
}

export async function applyRuleToHistoryAction(formData: FormData) {
  const context = await getViewerHouseholdContext();
  if (!context.viewer) redirect("/settings?error=Bitte+einloggen");

  const id = String(formData.get("id") ?? "").trim();

  const existing = await prisma.categorizationRule.findFirst({
    where: { id, householdId: context.householdId },
    select: { id: true },
  });
  if (!existing) redirectWithError("Regel nicht gefunden.");

  const result = await applyRulesToHousehold({
    householdId: context.householdId,
    ruleId: id,
  });

  redirect(`/rules?applied=${result.matched}&updated=${result.updated}`);
}
