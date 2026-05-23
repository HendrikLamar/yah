export type SnapshotTransaction = {
  id: string;
  bookingDate: Date;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  categoryName: string | null;
  responsibilityType: "SHARED" | "USER";
  accountName: string;
  purposeRaw: string;
  counterpartyName: string | null;
  isInternalTransfer: boolean;
};

export type HouseholdSnapshot = {
  monthIncome: number;
  monthExpenses: number;
  monthNet: number;
  transferVolume: number;
  uncategorizedCount: number;
  sharedExpenses: number;
  personalExpenses: number;
  topCategories: Array<{ name: string; amount: number }>;
  recentTransactions: SnapshotTransaction[];
  monthRangeStart: Date;
  monthRangeEnd: Date;
  isPartialMonth: boolean;
};

export function buildHouseholdSnapshot(
  transactions: SnapshotTransaction[],
  now: Date = new Date(),
): HouseholdSnapshot {
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const monthLastDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  );
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const monthTransactions = transactions.filter((transaction) => {
    return (
      transaction.bookingDate.getUTCFullYear() === now.getUTCFullYear() &&
      transaction.bookingDate.getUTCMonth() === now.getUTCMonth()
    );
  });

  const nonTransfers = monthTransactions.filter((t) => !t.isInternalTransfer);
  const transfers = monthTransactions.filter((t) => t.isInternalTransfer);

  const monthIncome = sumAmounts(
    nonTransfers.filter((transaction) => transaction.direction === "INCOME"),
  );
  const monthExpenses = sumAmounts(
    nonTransfers.filter((transaction) => transaction.direction === "EXPENSE"),
    true,
  );
  const transferVolume = sumAmounts(transfers, true);
  const sharedExpenses = sumAmounts(
    nonTransfers.filter(
      (transaction) =>
        transaction.direction === "EXPENSE" && transaction.responsibilityType === "SHARED",
    ),
    true,
  );
  const personalExpenses = sumAmounts(
    nonTransfers.filter(
      (transaction) =>
        transaction.direction === "EXPENSE" && transaction.responsibilityType === "USER",
    ),
    true,
  );

  const topCategories = Array.from(
    nonTransfers
      .filter((transaction) => transaction.direction === "EXPENSE")
      .reduce((groups, transaction) => {
        const key = transaction.categoryName ?? "Uncategorized";
        const nextAmount = Math.abs(transaction.amount) + (groups.get(key) ?? 0);
        groups.set(key, nextAmount);
        return groups;
      }, new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }));

  const monthRangeEnd = today < monthLastDay ? today : monthLastDay;

  return {
    monthIncome,
    monthExpenses,
    monthNet: monthIncome - monthExpenses,
    transferVolume,
    uncategorizedCount: nonTransfers.filter((transaction) => !transaction.categoryName).length,
    sharedExpenses,
    personalExpenses,
    topCategories,
    recentTransactions: [...monthTransactions].sort(
      (left, right) => right.bookingDate.getTime() - left.bookingDate.getTime(),
    ),
    monthRangeStart: monthStart,
    monthRangeEnd,
    isPartialMonth: today < monthLastDay,
  };
}

function sumAmounts(transactions: SnapshotTransaction[], absolute = false): number {
  return transactions.reduce((total, transaction) => {
    return total + (absolute ? Math.abs(transaction.amount) : transaction.amount);
  }, 0);
}
