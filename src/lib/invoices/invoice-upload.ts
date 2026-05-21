import { prisma } from "@/lib/db/prisma";

import { summarizeInvoiceMatches } from "./allocations";
import { extractInvoiceMetadataFromFile } from "./extraction";
import { addDays } from "./utils";
import {
  findSuggestedInvoicePaymentMatches,
  type InvoiceMatchInput,
  type InvoiceTransactionCandidate,
} from "./matching";

const DEFAULT_INVOICE_WINDOW_DAYS = 45;
const EARLIEST_BOOKING_LOOKBACK_DAYS = 14;

export async function uploadInvoiceDocument(options: {
  householdId: string;
  uploadedByUserId: string;
  file: File;
  vendorName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  totalAmount?: number | null;
  currency?: string;
  notes?: string | null;
}) {
  const fileData = Buffer.from(await options.file.arrayBuffer());
  const currency = (options.currency ?? "EUR").trim().toUpperCase();
  const extracted = await extractInvoiceMetadataFromFile(options.file, fileData);

  const vendorName = options.vendorName?.trim() || extracted.vendorName || "";
  const invoiceNumber = options.invoiceNumber?.trim() || extracted.invoiceNumber || null;
  const invoiceDateRaw = options.invoiceDate?.trim() || extracted.invoiceDate || "";
  const dueDateRaw = options.dueDate?.trim() || extracted.dueDate || null;
  const totalAmount =
    options.totalAmount && Number.isFinite(options.totalAmount) && options.totalAmount > 0
      ? options.totalAmount
      : extracted.totalAmount;

  if (!vendorName) {
    throw new Error("Vendor name is required or must be extractable from the document.");
  }

  if (!invoiceDateRaw) {
    throw new Error("Invoice date is required or must be extractable from the document.");
  }

  if (!totalAmount || !Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error("Invoice amount must be positive or extractable from the document.");
  }

  const invoiceDate = parseDateOnly(invoiceDateRaw, "invoiceDate");
  const dueDate = dueDateRaw ? parseDateOnly(dueDateRaw, "dueDate") : null;

  const invoiceInput: InvoiceMatchInput = {
    vendorName,
    invoiceNumber,
    invoiceDate,
    dueDate,
    totalAmount,
    currency,
  };

  const candidates = await prisma.transaction.findMany({
    where: {
      householdId: options.householdId,
      direction: "EXPENSE",
      currency,
      bookingDate: {
        gte: addDays(invoiceDate, -EARLIEST_BOOKING_LOOKBACK_DAYS),
        lte: addDays(dueDate ?? invoiceDate, DEFAULT_INVOICE_WINDOW_DAYS),
      },
    },
    select: {
      id: true,
      bookingDate: true,
      amount: true,
      currency: true,
      direction: true,
      counterpartyName: true,
      normalizedMerchant: true,
      purposeRaw: true,
      invoicePaymentMatches: {
        select: {
          allocatedAmount: true,
        },
      },
    },
    orderBy: {
      bookingDate: "desc",
    },
    take: 50,
  });

  const suggestionPlan = findSuggestedInvoicePaymentMatches(invoiceInput, candidates.map(toMatchCandidate));
  const created = await prisma.invoiceDocument.create({
    data: {
      householdId: options.householdId,
      uploadedByUserId: options.uploadedByUserId,
      fileName: options.file.name,
      mimeType: options.file.type || "application/octet-stream",
      fileData,
      documentSha256: extracted.documentSha256,
      vendorName,
      invoiceNumber,
      invoiceDate,
      dueDate,
      totalAmount: totalAmount.toFixed(2),
      currency,
      notes: options.notes?.trim() || null,
      matchStatus: suggestionPlan?.status ?? "UNMATCHED",
      matchedTransactionId: suggestionPlan
        ? [...suggestionPlan.matches].sort((a, b) => b.allocatedAmount - a.allocatedAmount)[0]?.transactionId ?? null
        : null,
      matchConfidence: suggestionPlan ? suggestionPlan.confidence.toFixed(2) : null,
      matchReason: suggestionPlan?.reason ?? null,
      extractedText: extracted.text || null,
      extractionMethod: extracted.method,
      extractionConfidence: extracted.confidence.toFixed(2),
      paymentMatches: suggestionPlan
        ? {
            create: suggestionPlan.matches.map((match) => ({
              transactionId: match.transactionId,
              allocatedAmount: match.allocatedAmount.toFixed(2),
              matchStatus: suggestionPlan.remainingAmount === 0 ? "AUTO_MATCHED" : "PARTIALLY_MATCHED",
              matchConfidence: match.confidence.toFixed(2),
              matchReason: match.reason,
            })),
          }
        : undefined,
    },
    include: {
      matchedTransaction: {
        include: {
          account: true,
          category: true,
        },
      },
      paymentMatches: {
        include: {
          transaction: {
            include: {
              account: true,
              category: true,
            },
          },
        },
      },
    },
  });

  const summary = summarizeInvoiceMatches(Number(created.totalAmount), created.paymentMatches);

  return {
    invoiceId: created.id,
    fileName: created.fileName,
    matchStatus: created.matchStatus,
    matchedTransaction: created.matchedTransaction,
    matchReason: created.matchReason,
    matchConfidence: created.matchConfidence ? Number(created.matchConfidence) : null,
    linkedPaymentCount: created.paymentMatches.length,
    linkedAmount: summary.linkedAmount,
    remainingAmount: summary.remainingAmount,
    extractedFields: {
      vendorName,
      invoiceNumber,
      invoiceDate: invoiceDate.toISOString().slice(0, 10),
      dueDate: dueDate?.toISOString().slice(0, 10) ?? null,
      totalAmount,
      method: extracted.method,
    },
  };
}

function toMatchCandidate(transaction: {
  id: string;
  bookingDate: Date;
  amount: unknown;
  currency: string;
  direction: "INCOME" | "EXPENSE";
  counterpartyName: string | null;
  normalizedMerchant: string | null;
  purposeRaw: string;
  invoicePaymentMatches: Array<{ allocatedAmount: unknown }>;
}): InvoiceTransactionCandidate {
  return {
    id: transaction.id,
    bookingDate: transaction.bookingDate,
    amount: Number(transaction.amount),
    currency: transaction.currency,
    direction: transaction.direction,
    counterpartyName: transaction.counterpartyName,
    normalizedMerchant: transaction.normalizedMerchant,
    purposeRaw: transaction.purposeRaw,
    allocatedAmount: transaction.invoicePaymentMatches.reduce((sum, match) => sum + Number(match.allocatedAmount), 0),
  };
}

function parseDateOnly(raw: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Invalid ${fieldName}. Expected YYYY-MM-DD.`);
  }

  return new Date(`${raw}T00:00:00.000Z`);
}

