import { FeaturePage } from "@/components/app-shell/feature-page";
import { buildHouseholdSnapshot } from "@/lib/analysis/household-snapshot";
import { prisma } from "@/lib/db/prisma";
import { getViewerHouseholdContext } from "@/lib/household/viewer";

export default async function DashboardPage() {
  const context = await getViewerHouseholdContext();
  const visibilityFilter = context.viewer
    ? {
        OR: [
          { account: { visibilityOwnerType: "SHARED" as const } },
          { account: { visibilityOwnerUserId: context.viewer.userId } },
        ],
      }
    : {};
  const accountVisibilityFilter = context.viewer
    ? {
        OR: [
          { visibilityOwnerType: "SHARED" as const },
          { visibilityOwnerUserId: context.viewer.userId },
        ],
      }
    : {};

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  const [accounts, monthTransactions] = await Promise.all([
    prisma.account.findMany({
      where: {
        householdId: context.householdId,
        ...accountVisibilityFilter,
      },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: context.householdId,
        bookingDate: { gte: monthStart, lte: monthEnd },
        ...visibilityFilter,
      },
      include: {
        account: true,
        category: true,
      },
      orderBy: {
        bookingDate: "desc",
      },
    }),
  ]);

  const snapshot = buildHouseholdSnapshot(
    monthTransactions.map((transaction) => ({
      bookingDate: transaction.bookingDate,
      amount: Number(transaction.amount),
      direction: transaction.direction,
      categoryName: transaction.category?.name ?? null,
      responsibilityType: transaction.responsibilityType,
      accountName: transaction.account.name,
      purposeRaw: transaction.purposeRaw,
      counterpartyName: transaction.counterpartyName,
    })),
  );

  return (
    <FeaturePage
      eyebrow="dashboard"
      title="Cashflow analysis and monthly snapshot"
      description={`Live data for ${context.householdName}: shared plus personal account movement analysis, seeded demo data, and whatever arrives from DKB or CSV import next.`}
      statusLabel={context.viewer ? `Viewer: ${context.viewer.displayName}` : "Demo household active"}
      statusTone="success"
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Income this month" value={formatCurrency(snapshot.monthIncome)} />
        <MetricCard label="Expenses this month" value={formatCurrency(snapshot.monthExpenses)} />
        <MetricCard label="Net this month" value={formatCurrency(snapshot.monthNet)} />
        <MetricCard label="Uncategorized" value={String(snapshot.uncategorizedCount)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-slate-100">How spending is split</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <StatPanel
              title="Shared household expenses"
              value={formatCurrency(snapshot.sharedExpenses)}
              detail="Common groceries, rent, utilities, eating out and other shared costs."
            />
            <StatPanel
              title="Personal expenses"
              value={formatCurrency(snapshot.personalExpenses)}
              detail="Private spend assigned to the signed-in user or demo personal accounts."
            />
          </div>

          <h4 className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Top expense categories this month
          </h4>
          <ul className="mt-4 space-y-3">
            {snapshot.topCategories.map((category) => (
              <li
                key={category.name}
                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300"
              >
                <span>{category.name}</span>
                <strong className="text-slate-100">{formatCurrency(category.amount)}</strong>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-slate-100">Imported accounts</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3"
              >
                <div className="font-semibold text-slate-100">{account.name}</div>
                <div>
                  {account.visibilityOwnerType === "SHARED"
                    ? "Shared account"
                    : `Private account for ${account.visibilityOwnerUserId ? "one household member" : "a specific user"}`}
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold text-slate-100">Recent movements</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="pb-3">Date</th>
                <th className="pb-3">Account</th>
                <th className="pb-3">Counterparty</th>
                <th className="pb-3">Purpose</th>
                <th className="pb-3">Category</th>
                <th className="pb-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.recentTransactions.slice(0, 10).map((transaction) => (
                <tr key={`${transaction.accountName}-${transaction.bookingDate.toISOString()}-${transaction.purposeRaw}`} className="border-t border-slate-800">
                  <td className="py-3">{transaction.bookingDate.toISOString().slice(0, 10)}</td>
                  <td className="py-3">{transaction.accountName}</td>
                  <td className="py-3">{transaction.counterpartyName ?? "—"}</td>
                  <td className="py-3">{transaction.purposeRaw}</td>
                  <td className="py-3">{transaction.categoryName ?? "Uncategorized"}</td>
                  <td className="py-3 text-right font-medium text-slate-100">
                    {formatCurrency(transaction.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </FeaturePage>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-50">{value}</p>
    </article>
  );
}

function StatPanel({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-2 text-xl font-semibold text-slate-100">{value}</div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{detail}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
