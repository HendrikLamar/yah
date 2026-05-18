import { createHash } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import type { ParsedCsvTransaction } from "@/lib/import/csv";

export async function importCsvTransactions(options: {
  householdId: string;
  accountName: string;
  transactions: ParsedCsvTransaction[];
  ownerUserId?: string | null;
  responsibilityType?: "SHARED" | "USER";
  userId: string;
  sourceFileName?: string;
}) {
  const fallbackCategory = await prisma.category.findUnique({
    where: {
      householdId_slug: {
        householdId: options.householdId,
        slug: "uncategorized",
      },
    },
  });

  if (!fallbackCategory) {
    throw new Error("Missing uncategorized category in household.");
  }

  const visibilityOwnerType: "SHARED" | "USER" = options.ownerUserId ? "USER" : "SHARED";
  const responsibilityType = options.responsibilityType ?? "SHARED";

  const connection = await prisma.bankConnection.upsert({
    where: {
      id: `csv-upload-${options.householdId}`,
    },
    update: {
      householdId: options.householdId,
      provider: "CSV_UPLOAD",
      status: "ACTIVE",
      lastErrorMessage: null,
    },
    create: {
      id: `csv-upload-${options.householdId}`,
      householdId: options.householdId,
      provider: "CSV_UPLOAD",
      status: "ACTIVE",
    },
  });

  const externalAccountId = buildCsvExternalAccountId(options.accountName, options.ownerUserId);

  const account = await prisma.account.upsert({
    where: {
      bankConnectionId_externalAccountId: {
        bankConnectionId: connection.id,
        externalAccountId,
      },
    },
    update: {
      householdId: options.householdId,
      name: options.accountName,
      visibilityOwnerType,
      visibilityOwnerUserId: options.ownerUserId ?? null,
      accountType: "CHECKING",
      isActive: true,
    },
    create: {
      householdId: options.householdId,
      bankConnectionId: connection.id,
      externalAccountId,
      name: options.accountName,
      visibilityOwnerType,
      visibilityOwnerUserId: options.ownerUserId ?? null,
      accountType: "CHECKING",
    },
  });

  const data = options.transactions.map((transaction) => ({
    householdId: options.householdId,
    accountId: account.id,
    bookingDate: new Date(`${transaction.bookingDate}T00:00:00.000Z`),
    valueDate: transaction.valueDate ? new Date(`${transaction.valueDate}T00:00:00.000Z`) : null,
    amount: transaction.amount,
    currency: transaction.currency,
    direction: transaction.direction,
    counterpartyName: transaction.counterpartyName,
    purposeRaw: transaction.purposeRaw,
    categoryId: fallbackCategory.id,
    responsibilityType,
    responsibilityUserId: options.ownerUserId ?? null,
    importHash: buildImportHash(account.id, transaction),
  }));

  const result = await prisma.transaction.createMany({
    data,
    skipDuplicates: true,
  });

  // Create ImportBatch for provenance tracking
  const batch = await prisma.importBatch.create({
    data: {
      householdId: options.householdId,
      userId: options.userId,
      sourceFileName: options.sourceFileName ?? null,
      sourceFormat: "CSV",
      accountName: options.accountName,
      totalRows: options.transactions.length,
      importedCount: result.count,
      skippedCount: options.transactions.length - result.count,
    },
  });

  // Link the imported transactions to this batch by matching import hashes
  const importHashes = data.map((row) => row.importHash);
  await prisma.transaction.updateMany({
    where: {
      importHash: { in: importHashes },
      importBatchId: null,
    },
    data: {
      importBatchId: batch.id,
    },
  });

  return {
    accountName: account.name,
    importedCount: result.count,
    skippedCount: options.transactions.length - result.count,
    importBatchId: batch.id,
  };
}

function slugify(value: string): string {
  return `csv-${value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function buildCsvExternalAccountId(accountName: string, ownerUserId?: string | null): string {
  const accountSlug = slugify(accountName).replace(/^csv-/, "");
  const scope = ownerUserId
    ? `user-${slugify(ownerUserId).replace(/^csv-/, "")}`
    : "shared";

  return `csv-${scope}-${accountSlug}`;
}

function buildImportHash(accountId: string, transaction: ParsedCsvTransaction): string {
  return createHash("sha256")
    .update(
      [
        accountId,
        transaction.bookingDate,
        transaction.valueDate ?? "",
        transaction.amount.toFixed(2),
        transaction.counterpartyName ?? "",
        transaction.purposeRaw,
      ].join("|"),
    )
    .digest("hex");
}
