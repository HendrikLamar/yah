import type { InvoiceMatchStatus } from "./matching";

import { roundToCents } from "./utils";

type MatchLike = {
  allocatedAmount: unknown;
  matchStatus?: InvoiceMatchStatus | string | null;
  matchConfidence?: unknown;
  matchReason?: string | null;
  transactionId?: string | null;
  transaction?: { id: string } | null;
};

export function summarizeInvoiceMatches(totalAmount: number, matches: MatchLike[]) {
  const linkedAmount = roundToCents(matches.reduce((sum, match) => sum + Number(match.allocatedAmount ?? 0), 0));
  const remainingAmount = Math.max(0, roundToCents(totalAmount - linkedAmount));
  const primaryMatch = [...matches]
    .sort((left, right) => Number(right.allocatedAmount) - Number(left.allocatedAmount))[0] ?? null;

  const status = deriveMatchStatus(matches, remainingAmount);
  const confidenceValues = matches
    .map((match) => (match.matchConfidence === null || match.matchConfidence === undefined ? null : Number(match.matchConfidence)))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const matchConfidence = confidenceValues.length > 0
    ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(2))
    : null;
  const matchReason = matches.map((match) => match.matchReason).filter(Boolean).join(" + ") || null;

  return {
    linkedAmount,
    remainingAmount,
    status,
    matchConfidence,
    matchReason,
    primaryTransactionId: primaryMatch?.transactionId ?? primaryMatch?.transaction?.id ?? null,
  };
}

function deriveMatchStatus(matches: MatchLike[], remainingAmount: number): InvoiceMatchStatus {
  if (matches.length === 0) {
    return "UNMATCHED";
  }

  if (remainingAmount > 0.01) {
    return "PARTIALLY_MATCHED";
  }

  const allAutoMatched = matches.every((match) => match.matchStatus === "AUTO_MATCHED");
  return allAutoMatched ? "AUTO_MATCHED" : "MANUALLY_CONFIRMED";
}

