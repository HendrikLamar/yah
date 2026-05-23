"use server";

import { redirect } from "next/navigation";

import { getViewerHouseholdContext } from "@/lib/household/viewer";
import { parseTransactionCsv } from "@/lib/import/csv";
import { importCsvTransactions } from "@/lib/import/transaction-import";

export async function uploadCsvAction(formData: FormData) {
  const file = formData.get("csvFile");
  const accountName = String(formData.get("accountName") ?? "CSV Import").trim();

  if (!(file instanceof File) || file.size === 0) {
    redirect("/transactions?error=Bitte+eine+CSV-Datei+ausw%C3%A4hlen");
  }

  const context = await getViewerHouseholdContext();
  const ownerUserId = context.viewer?.userId ?? null;
  const text = await file.text();
  const parsed = parseTransactionCsv(text);
  const result = await importCsvTransactions({
    householdId: context.householdId,
    accountName,
    transactions: parsed,
    ownerUserId,
    responsibilityType: ownerUserId ? "USER" : "SHARED",
    userId: ownerUserId ?? "anonymous-import",
    sourceFileName: file instanceof File ? file.name : undefined,
  });

  redirect(
    `/transactions?imported=${result.importedCount}&skipped=${result.skippedCount}&account=${encodeURIComponent(result.accountName)}`,
  );
}
