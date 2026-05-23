"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import {
  buildAccountVisibilityFilter,
  getViewerHouseholdContext,
} from "@/lib/household/viewer";
import { parseTransactionCsv } from "@/lib/import/csv";
import { importCsvTransactions } from "@/lib/import/transaction-import";

const ERROR_MESSAGES = {
  noFile: "Bitte eine CSV-Datei auswählen.",
  noAccount: "Bitte ein bestehendes Konto wählen oder ein neues benennen.",
  ambiguousAccount:
    "Bitte entweder ein bestehendes Konto wählen oder einen neuen Namen vergeben — nicht beides.",
  unknownAccount: "Das gewählte Konto wurde nicht gefunden.",
  missingColumns: "CSV-Datei enthält keine Spalten für Buchungsdatum und Betrag.",
  unsupportedDate: "Datumsformat in der CSV wird nicht unterstützt.",
  unsupportedAmount: "Betrag in der CSV konnte nicht gelesen werden.",
  fallback: "CSV-Import fehlgeschlagen. Bitte Datei prüfen.",
} as const;

function redirectWithError(message: string): never {
  redirect(`/transactions?error=${encodeURIComponent(message)}`);
}

function mapImportErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return ERROR_MESSAGES.fallback;
  const m = error.message;
  if (/required columns/i.test(m)) return ERROR_MESSAGES.missingColumns;
  if (/Unsupported date format/i.test(m)) return ERROR_MESSAGES.unsupportedDate;
  if (/Unsupported amount/i.test(m)) return ERROR_MESSAGES.unsupportedAmount;
  return ERROR_MESSAGES.fallback;
}

export async function uploadCsvAction(formData: FormData) {
  const file = formData.get("csvFile");
  const accountMode = String(formData.get("accountMode") ?? "new").trim();
  const rawAccountId = String(formData.get("accountId") ?? "").trim();
  const rawAccountName = String(formData.get("accountName") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    redirectWithError(ERROR_MESSAGES.noFile);
  }

  const context = await getViewerHouseholdContext();

  if (!context.viewer) {
    redirect("/settings?error=Bitte+einloggen");
  }

  const wantsExisting = accountMode === "existing";

  if (wantsExisting) {
    if (!rawAccountId) redirectWithError(ERROR_MESSAGES.noAccount);
    if (rawAccountName) redirectWithError(ERROR_MESSAGES.ambiguousAccount);
  } else if (!rawAccountName) {
    redirectWithError(ERROR_MESSAGES.noAccount);
  }

  let resolvedAccountId: string | undefined;
  if (wantsExisting) {
    const account = await prisma.account.findFirst({
      where: {
        id: rawAccountId,
        householdId: context.householdId,
        isActive: true,
        ...buildAccountVisibilityFilter(context.viewer),
      },
      select: { id: true },
    });

    if (!account) {
      redirectWithError(ERROR_MESSAGES.unknownAccount);
    }

    resolvedAccountId = account.id;
  }

  const text = await file.text();

  let result: Awaited<ReturnType<typeof importCsvTransactions>>;
  try {
    const parsed = parseTransactionCsv(text);
    result = await importCsvTransactions({
      householdId: context.householdId,
      ...(resolvedAccountId
        ? { accountId: resolvedAccountId }
        : { accountName: rawAccountName }),
      transactions: parsed,
      ownerUserId: context.viewer.userId,
      responsibilityType: "USER",
      userId: context.viewer.userId,
      sourceFileName: file.name,
    });
  } catch (error) {
    console.error("[uploadCsvAction] CSV import failed", error);
    redirectWithError(mapImportErrorMessage(error));
  }

  redirect(
    `/transactions?imported=${result.importedCount}&skipped=${result.skippedCount}&account=${encodeURIComponent(result.accountName)}`,
  );
}
