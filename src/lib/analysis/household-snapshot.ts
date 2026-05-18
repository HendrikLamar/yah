export type SnapshotTransaction = {
  bookingDate: Date;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  categoryName: string | null;
  responsibilityType: "SHARED" | "USER";
  accountName: string;
  purposeRaw: string;
  counterpartyName: string | null;
};

export type HouseholdSnapshot = {
  monthIncome: number;
  monthExpenses: number;
  monthNet: number;
  uncategorizedCount: number;
  sharedExpenses: number;
  personalExpenses: number;
  topCategories: Array<{ name: string; amount: number }>;
  recentTransactions: SnapshotTransaction[];
};

export function buildHouseholdSnapshot(
  transactions: SnapshotTransaction[],
  now: Date = new Date(),
): HouseholdSnapshot {
  const monthTransactions = transactions.filter((transaction) => {
    return (
      transaction.bookingDate.getUTCFullYear() === now.getUTCFullYear() &&
      transaction.bookingDate.getUTCMonth() === now.getUTCMonth()
    );
  });

  const monthIncome = sumAmounts(
    monthTransactions.filter((transaction) => transaction.direction === "INCOME"),
  );
  const monthExpenses = sumAmounts(
    monthTransactions.filter((transaction) => transaction.direction === "EXPENSE"),
    true,
  );
  const sharedExpenses = sumAmounts(
    monthTransactions.filter(
      (transaction) =>
        transaction.direction === "EXPENSE" && transaction.responsibilityType === "SHARED",
    ),
    true,
  );
  const personalExpenses = sumAmounts(
    monthTransactions.filter(
      (transaction) => transaction.direction === "EXPENSE" && transaction.responsibilityType === "USER",
    ),
    true,
  );

  const topCategories = Array.from(
    monthTransactions
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

  return {
    monthIncome,
    monthExpenses,
    monthNet: monthIncome - monthExpenses,
    uncategorizedCount: monthTransactions.filter((transaction) => !transaction.categoryName).length,
    sharedExpenses,
    personalExpenses,
    topCategories,
    recentTransactions: [...monthTransactions].sort(
      (left, right) => right.bookingDate.getTime() - left.bookingDate.getTime(),
    ),
  };
}

function sumAmounts(transactions: SnapshotTransaction[], absolute = false): number {
  return transactions.reduce((total, transaction) => {
    return total + (absolute ? Math.abs(transaction.amount) : transaction.amount);
  }, 0);
}
