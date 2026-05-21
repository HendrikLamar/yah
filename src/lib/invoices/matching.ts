import { roundToCents } from "./utils";

export type InvoiceMatchStatus = "UNMATCHED" | "PARTIALLY_MATCHED" | "AUTO_MATCHED" | "MANUALLY_CONFIRMED";

export type InvoiceMatchInput = {
  vendorName: string;
  invoiceNumber?: string | null;
  invoiceDate: Date;
  dueDate?: Date | null;
  totalAmount: number;
  currency: string;
};

export type InvoiceTransactionCandidate = {
  id: string;
  bookingDate: Date;
  amount: number;
  currency: string;
  direction: "INCOME" | "EXPENSE";
  counterpartyName?: string | null;
  normalizedMerchant?: string | null;
  purposeRaw: string;
  allocatedAmount?: number;
};

export type InvoiceMatchCandidate = {
  transactionId: string;
  score: number;
  confidence: number;
  reason: string;
  availableAmount: number;
  suggestedAllocationAmount: number;
};

export type SuggestedInvoicePaymentMatch = {
  transactionId: string;
  allocatedAmount: number;
  availableAmount: number;
  confidence: number;
  reason: string;
};

export type SuggestedInvoicePaymentPlan = {
  matches: SuggestedInvoicePaymentMatch[];
  totalAllocated: number;
  remainingAmount: number;
  confidence: number;
  status: InvoiceMatchStatus;
  reason: string;
};

const AUTO_MATCH_THRESHOLD = 0.75;
const MATCH_TOLERANCE = 0.01;
const MAX_COMBINATION_CANDIDATES = 6;

export function findBestInvoiceTransactionMatch(
  invoice: InvoiceMatchInput,
  transactions: InvoiceTransactionCandidate[],
): InvoiceMatchCandidate | null {
  const ranked = rankInvoiceTransactionMatches(invoice, transactions);
  const winner = ranked[0];

  if (!winner || winner.score < AUTO_MATCH_THRESHOLD || !amountsMatch(winner.suggestedAllocationAmount, invoice.totalAmount)) {
    return null;
  }

  return winner;
}

export function rankInvoiceTransactionMatches(
  invoice: InvoiceMatchInput,
  transactions: InvoiceTransactionCandidate[],
): InvoiceMatchCandidate[] {
  return transactions
    .map((transaction) => scoreInvoiceTransactionMatch(invoice, transaction))
    .filter((candidate): candidate is InvoiceMatchCandidate => candidate !== null)
    .sort((left, right) => right.score - left.score);
}

export function findSuggestedInvoicePaymentMatches(
  invoice: InvoiceMatchInput,
  transactions: InvoiceTransactionCandidate[],
): SuggestedInvoicePaymentPlan | null {
  const ranked = rankInvoiceTransactionMatches(invoice, transactions);
  const exactSingle = ranked.find(
    (candidate) => candidate.score >= AUTO_MATCH_THRESHOLD && amountsMatch(candidate.suggestedAllocationAmount, invoice.totalAmount),
  );

  if (exactSingle) {
    return finalizePlan(
      invoice.totalAmount,
      [
        {
          transactionId: exactSingle.transactionId,
          allocatedAmount: exactSingle.suggestedAllocationAmount,
          availableAmount: exactSingle.availableAmount,
          confidence: exactSingle.confidence,
          reason: exactSingle.reason,
        },
      ],
      "AUTO_MATCHED",
      exactSingle.reason,
    );
  }

  const combination = findCombinationPlan(invoice.totalAmount, ranked.slice(0, MAX_COMBINATION_CANDIDATES));
  if (combination) {
    return finalizePlan(invoice.totalAmount, combination.matches, "AUTO_MATCHED", combination.reason);
  }

  const partial = ranked[0];
  if (!partial) {
    return null;
  }

  return finalizePlan(
    invoice.totalAmount,
    [
      {
        transactionId: partial.transactionId,
        allocatedAmount: partial.suggestedAllocationAmount,
        availableAmount: partial.availableAmount,
        confidence: partial.confidence,
        reason: partial.reason,
      },
    ],
    "PARTIALLY_MATCHED",
    partial.reason,
  );
}

function findCombinationPlan(totalAmount: number, ranked: InvoiceMatchCandidate[]): SuggestedInvoicePaymentPlan | null {
  const candidates = ranked.filter((candidate) => candidate.suggestedAllocationAmount > 0);
  let best: SuggestedInvoicePaymentPlan | null = null;

  const stack: SuggestedInvoicePaymentMatch[] = [];

  function search(index: number, allocatedSoFar: number) {
    const roundedAllocated = roundToCents(allocatedSoFar);

    if (amountsMatch(roundedAllocated, totalAmount)) {
      const plan = finalizePlan(totalAmount, stack.slice(), "AUTO_MATCHED", "split payment auto-match");
      if (!best || plan.confidence > best.confidence) {
        best = plan;
      }
      return;
    }

    if (roundedAllocated > totalAmount + MATCH_TOLERANCE || index >= candidates.length || stack.length >= 3) {
      return;
    }

    for (let cursor = index; cursor < candidates.length; cursor += 1) {
      const candidate = candidates[cursor];
      const remaining = roundToCents(totalAmount - roundedAllocated);
      const allocation = roundToCents(Math.min(candidate.suggestedAllocationAmount, remaining));
      if (allocation <= 0) {
        continue;
      }

      stack.push({
        transactionId: candidate.transactionId,
        allocatedAmount: allocation,
        availableAmount: candidate.availableAmount,
        confidence: candidate.confidence,
        reason: candidate.reason,
      });
      search(cursor + 1, roundedAllocated + allocation);
      stack.pop();
    }
  }

  search(0, 0);
  return best;
}

function finalizePlan(
  totalAmount: number,
  matches: SuggestedInvoicePaymentMatch[],
  status: InvoiceMatchStatus,
  reason: string,
): SuggestedInvoicePaymentPlan {
  const totalAllocated = roundToCents(matches.reduce((sum, match) => sum + match.allocatedAmount, 0));
  const remainingAmount = Math.max(0, roundToCents(totalAmount - totalAllocated));
  const effectiveStatus = remainingAmount === 0 ? status : "PARTIALLY_MATCHED";
  const confidence = Number(
    Math.min(
      1,
      matches.reduce((sum, match) => sum + match.confidence, 0) / Math.max(matches.length, 1),
    ).toFixed(2),
  );

  return {
    matches,
    totalAllocated,
    remainingAmount,
    confidence,
    status: effectiveStatus,
    reason,
  };
}

function scoreInvoiceTransactionMatch(
  invoice: InvoiceMatchInput,
  transaction: InvoiceTransactionCandidate,
): InvoiceMatchCandidate | null {
  if (transaction.direction !== "EXPENSE") {
    return null;
  }

  if (normalizeCurrency(transaction.currency) !== normalizeCurrency(invoice.currency)) {
    return null;
  }

  const invoiceAmount = roundToCents(Math.abs(invoice.totalAmount));
  const transactionAmount = roundToCents(Math.abs(transaction.amount));
  const allocatedAmount = roundToCents(Math.abs(transaction.allocatedAmount ?? 0));
  const availableAmount = roundToCents(Math.max(0, transactionAmount - allocatedAmount));

  if (availableAmount <= 0) {
    return null;
  }

  const suggestedAllocationAmount = roundToCents(Math.min(invoiceAmount, availableAmount));
  const amountDelta = roundToCents(Math.abs(invoiceAmount - availableAmount));
  const scoreParts: string[] = [];
  let score = 0;

  if (amountsMatch(availableAmount, invoiceAmount)) {
    score += 0.6;
    scoreParts.push("exact amount");
  } else if (availableAmount > invoiceAmount) {
    score += 0.42;
    scoreParts.push("bundled payment covers invoice");
  } else {
    const coverage = availableAmount / invoiceAmount;
    if (coverage < 0.2) {
      return null;
    }
    score += Math.max(0.18, Number((coverage * 0.45).toFixed(2)));
    scoreParts.push(`partial payment covers ${(coverage * 100).toFixed(0)}%`);
  }

  if (amountDelta <= 0.1) {
    score += 0.03;
  }

  const bookingDate = startOfDay(transaction.bookingDate);
  const invoiceDate = startOfDay(invoice.invoiceDate);
  const dueDate = invoice.dueDate ? startOfDay(invoice.dueDate) : null;
  const nearestDateDelta = Math.min(
    differenceInDays(bookingDate, invoiceDate),
    dueDate ? differenceInDays(bookingDate, dueDate) : Number.POSITIVE_INFINITY,
  );

  if (nearestDateDelta <= 3) {
    score += 0.2;
    scoreParts.push("date within 3 days");
  } else if (nearestDateDelta <= 14) {
    score += 0.14;
    scoreParts.push("date within 14 days");
  } else if (nearestDateDelta <= 45) {
    score += 0.08;
    scoreParts.push("date within 45 days");
  } else if (nearestDateDelta <= 75) {
    score += 0.03;
    scoreParts.push("date weakly plausible");
  } else {
    return null;
  }

  const vendorScore = scoreVendorMatch(invoice, transaction);
  score += vendorScore.score;
  if (vendorScore.reason) {
    scoreParts.push(vendorScore.reason);
  }

  if (invoice.invoiceNumber && normalizeText(transaction.purposeRaw).includes(normalizeText(invoice.invoiceNumber))) {
    score += 0.12;
    scoreParts.push("invoice number found in purpose");
  }

  return {
    transactionId: transaction.id,
    score,
    confidence: Math.min(1, Number(score.toFixed(2))),
    reason: scoreParts.join(" · "),
    availableAmount,
    suggestedAllocationAmount,
  };
}

function scoreVendorMatch(
  invoice: InvoiceMatchInput,
  transaction: InvoiceTransactionCandidate,
): { score: number; reason: string | null } {
  const vendorNeedle = normalizeText(invoice.vendorName);
  const haystack = normalizeText(
    [transaction.counterpartyName, transaction.normalizedMerchant, transaction.purposeRaw]
      .filter(Boolean)
      .join(" "),
  );

  if (!vendorNeedle || !haystack) {
    return { score: 0, reason: null };
  }

  if (haystack.includes(vendorNeedle)) {
    return { score: 0.22, reason: "vendor name match" };
  }

  const vendorTokens = vendorNeedle.split(" ").filter((token) => token.length >= 4);
  const matchingTokens = vendorTokens.filter((token) => haystack.includes(token));

  if (matchingTokens.length >= 2) {
    return { score: 0.18, reason: `vendor token match (${matchingTokens.join(", ")})` };
  }

  if (matchingTokens.length === 1) {
    return { score: 0.09, reason: `vendor token match (${matchingTokens[0]})` };
  }

  return { score: 0, reason: null };
}

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase();
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function differenceInDays(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) / (1000 * 60 * 60 * 24);
}

function startOfDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function amountsMatch(left: number, right: number) {
  return Math.abs(roundToCents(left) - roundToCents(right)) <= MATCH_TOLERANCE;
}
