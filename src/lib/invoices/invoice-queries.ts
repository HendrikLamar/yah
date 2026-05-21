import { prisma } from "@/lib/db/prisma";

import { summarizeInvoiceMatches } from "./allocations";
import { rankInvoiceTransactionMatches, type InvoiceMatchInput } from "./matching";
import { addDays, roundToCents } from "./utils";

const MATCH_CANDIDATE_LIMIT = 8;
const MATCH_LOOKBACK_DAYS = 14;
const MATCH_LOOKAHEAD_DAYS = 60;

export async function listInvoicesForHousehold(options: {
  householdId: string;
  filter?: "all" | "matched" | "unmatched";
  take?: number;
}) {
  const filter = options.filter ?? "all";

  const invoices = await prisma.invoiceDocument.findMany({
    where: {
      householdId: options.householdId,
    },
    include: {
      uploadedByUser: true,
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
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: Math.max(options.take ?? 20, 200),
  });

  const enriched = invoices.map((invoice) => {
    const summary = summarizeInvoiceMatches(Number(invoice.totalAmount), invoice.paymentMatches);
    return {
      ...invoice,
      derivedLinkedAmount: summary.linkedAmount,
      derivedRemainingAmount: summary.remainingAmount,
      derivedPrimaryTransactionId: summary.primaryTransactionId,
      derivedStatus: summary.status,
      derivedMatchConfidence: summary.matchConfidence,
      derivedMatchReason: summary.matchReason,
    };
  });

  const filtered = enriched.filter((invoice) => {
    if (filter === "matched") return invoice.derivedRemainingAmount === 0;
    if (filter === "unmatched") return invoice.derivedRemainingAmount > 0;
    return true;
  });

  return filtered.slice(0, options.take ?? 20);
}

export async function listMatchCandidatesForInvoice(options: {
  householdId: string;
  invoiceId: string;
}) {
  const invoice = await prisma.invoiceDocument.findFirst({
    where: {
      id: options.invoiceId,
      householdId: options.householdId,
    },
    select: {
      id: true,
      vendorName: true,
      invoiceNumber: true,
      invoiceDate: true,
      dueDate: true,
      totalAmount: true,
      currency: true,
      paymentMatches: {
        select: {
          transactionId: true,
          allocatedAmount: true,
        },
      },
    },
  });

  if (!invoice) {
    return [];
  }

  const linkedAmount = invoice.paymentMatches.reduce((sum, match) => sum + Number(match.allocatedAmount), 0);
  const remainingAmount = Math.max(0, roundToCents(Number(invoice.totalAmount) - linkedAmount));

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId: options.householdId,
      direction: "EXPENSE",
      currency: invoice.currency,
      bookingDate: {
        gte: addDays(invoice.invoiceDate, -MATCH_LOOKBACK_DAYS),
        lte: addDays(invoice.dueDate ?? invoice.invoiceDate, MATCH_LOOKAHEAD_DAYS),
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
      account: {
        select: {
          name: true,
        },
      },
      category: {
        select: {
          name: true,
        },
      },
      invoicePaymentMatches: {
        select: {
          invoiceId: true,
          allocatedAmount: true,
        },
      },
    },
    orderBy: {
      bookingDate: "desc",
    },
    take: 50,
  });

  const ranked = rankInvoiceTransactionMatches(
    {
      vendorName: invoice.vendorName,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      totalAmount: remainingAmount || Number(invoice.totalAmount),
      currency: invoice.currency,
    } satisfies InvoiceMatchInput,
    transactions.map((transaction) => ({
      id: transaction.id,
      bookingDate: transaction.bookingDate,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      direction: transaction.direction,
      counterpartyName: transaction.counterpartyName,
      normalizedMerchant: transaction.normalizedMerchant,
      purposeRaw: transaction.purposeRaw,
      allocatedAmount: transaction.invoicePaymentMatches
        .filter((match) => match.invoiceId !== invoice.id)
        .reduce((sum, match) => sum + Number(match.allocatedAmount), 0),
    })),
  );

  const rankedById = new Map(ranked.map((entry) => [entry.transactionId, entry]));

  return transactions
    .filter((transaction) => rankedById.has(transaction.id) || invoice.paymentMatches.some((match) => match.transactionId === transaction.id))
    .sort((left, right) => {
      const leftScore = rankedById.get(left.id)?.score ?? 0;
      const rightScore = rankedById.get(right.id)?.score ?? 0;
      return rightScore - leftScore;
    })
    .slice(0, MATCH_CANDIDATE_LIMIT)
    .map((transaction) => {
      const currentMatch = invoice.paymentMatches.find((match) => match.transactionId === transaction.id) ?? null;
      const allocatedElsewhere = transaction.invoicePaymentMatches
        .filter((match) => match.invoiceId !== invoice.id)
        .reduce((sum, match) => sum + Number(match.allocatedAmount), 0);
      const availableAmount = Math.max(0, roundToCents(Math.abs(Number(transaction.amount)) - allocatedElsewhere));
      const suggestedAllocationAmount = Math.min(availableAmount, remainingAmount || Number(invoice.totalAmount));
      const ranking = rankedById.get(transaction.id);

      return {
        id: transaction.id,
        bookingDate: transaction.bookingDate,
        amount: Number(transaction.amount),
        counterpartyName: transaction.counterpartyName,
        purposeRaw: transaction.purposeRaw,
        accountName: transaction.account.name,
        categoryName: transaction.category?.name ?? null,
        score: ranking?.score ?? null,
        confidence: ranking?.confidence ?? null,
        reason: ranking?.reason ?? null,
        selected: Boolean(currentMatch),
        availableAmount,
        existingAllocatedAmount: currentMatch ? Number(currentMatch.allocatedAmount) : 0,
        suggestedAllocationAmount: roundToCents(currentMatch ? Number(currentMatch.allocatedAmount) : suggestedAllocationAmount),
      };
    });
}

export async function confirmInvoiceMatch(options: {
  householdId: string;
  invoiceId: string;
  transactionId: string;
  allocatedAmount?: number | null;
}) {
  const invoice = await prisma.invoiceDocument.findFirst({
    where: {
      id: options.invoiceId,
      householdId: options.householdId,
    },
    include: {
      paymentMatches: true,
    },
  });

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  const transaction = await prisma.transaction.findFirst({
    where: {
      id: options.transactionId,
      householdId: options.householdId,
      direction: "EXPENSE",
    },
    include: {
      invoicePaymentMatches: true,
    },
  });

  if (!transaction) {
    throw new Error("Transaction not found for this household.");
  }

  const existingMatch = invoice.paymentMatches.find((match) => match.transactionId === transaction.id) ?? null;
  const invoiceSummary = summarizeInvoiceMatches(Number(invoice.totalAmount), invoice.paymentMatches);
  const remainingInvoiceAmount = roundToCents(
    existingMatch ? invoiceSummary.remainingAmount + Number(existingMatch.allocatedAmount) : invoiceSummary.remainingAmount,
  );
  const allocatedElsewhere = transaction.invoicePaymentMatches
    .filter((match) => match.invoiceId !== invoice.id)
    .reduce((sum, match) => sum + Number(match.allocatedAmount), 0);
  const availableTransactionAmount = roundToCents(Math.abs(Number(transaction.amount)) - allocatedElsewhere);
  const requestedAllocation = options.allocatedAmount && Number.isFinite(options.allocatedAmount) && options.allocatedAmount > 0
    ? roundToCents(options.allocatedAmount)
    : roundToCents(Math.min(remainingInvoiceAmount, availableTransactionAmount));

  if (requestedAllocation <= 0) {
    throw new Error("Allocated amount must be positive.");
  }

  if (requestedAllocation - availableTransactionAmount > 0.01) {
    throw new Error("Allocated amount exceeds the remaining free amount of this payment.");
  }

  await prisma.invoicePaymentMatch.upsert({
    where: {
      invoiceId_transactionId: {
        invoiceId: invoice.id,
        transactionId: transaction.id,
      },
    },
    create: {
      invoiceId: invoice.id,
      transactionId: transaction.id,
      allocatedAmount: requestedAllocation.toFixed(2),
      matchStatus: "MANUALLY_CONFIRMED",
      matchConfidence: "1.00",
      matchReason: "manually confirmed allocation",
    },
    update: {
      allocatedAmount: requestedAllocation.toFixed(2),
      matchStatus: "MANUALLY_CONFIRMED",
      matchConfidence: "1.00",
      matchReason: "manually confirmed allocation",
    },
  });

  await refreshInvoiceAggregate(invoice.id);

  return prisma.invoiceDocument.findUnique({
    where: { id: invoice.id },
    include: {
      paymentMatches: true,
    },
  });
}

export async function clearInvoiceMatch(options: { householdId: string; invoiceId: string; transactionId?: string | null }) {
  const invoice = await prisma.invoiceDocument.findFirst({
    where: {
      id: options.invoiceId,
      householdId: options.householdId,
    },
    select: {
      id: true,
    },
  });

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  await prisma.invoicePaymentMatch.deleteMany({
    where: {
      invoiceId: invoice.id,
      ...(options.transactionId ? { transactionId: options.transactionId } : {}),
    },
  });

  await refreshInvoiceAggregate(invoice.id);

  return prisma.invoiceDocument.findUnique({
    where: { id: invoice.id },
    include: {
      paymentMatches: true,
    },
  });
}

export async function getInvoiceFileForHousehold(options: { householdId: string; invoiceId: string }) {
  const invoice = await prisma.invoiceDocument.findFirst({
    where: {
      id: options.invoiceId,
      householdId: options.householdId,
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileData: true,
    },
  });

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  return invoice;
}

async function refreshInvoiceAggregate(invoiceId: string) {
  const invoice = await prisma.invoiceDocument.findUnique({
    where: {
      id: invoiceId,
    },
    select: {
      totalAmount: true,
      paymentMatches: {
        select: {
          transactionId: true,
          allocatedAmount: true,
          matchStatus: true,
          matchConfidence: true,
          matchReason: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  const summary = summarizeInvoiceMatches(Number(invoice.totalAmount), invoice.paymentMatches);

  return prisma.invoiceDocument.update({
    where: {
      id: invoiceId,
    },
    data: {
      matchedTransactionId: summary.primaryTransactionId,
      matchStatus: summary.status,
      matchConfidence: summary.matchConfidence ? summary.matchConfidence.toFixed(2) : null,
      matchReason: summary.matchReason,
    },
  });
}

