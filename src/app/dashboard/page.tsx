import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
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
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );

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
      orderBy: { bookingDate: "desc" },
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

  const totalExpenses = snapshot.sharedExpenses + snapshot.personalExpenses;
  const sharedPercent =
    totalExpenses > 0 ? Math.round((snapshot.sharedExpenses / totalExpenses) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow="dashboard"
        title="Cashflow analysis and monthly snapshot"
        description={`Live data for ${context.householdName}: shared plus personal account movement analysis, seeded demo data, and whatever arrives from DKB or CSV import next.`}
        status={{
          label: context.viewer
            ? `Viewer: ${context.viewer.displayName}`
            : "Demo household active",
          variant: "success",
        }}
      />

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 md:col-span-6">
          <MetricCard hero label="Net this month" value={formatCurrency(snapshot.monthNet)} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Card padding="xl">
            <h3 className="text-headline-sm text-on-surface">
              How you spend together
            </h3>
            <p className="mt-md text-body-md text-on-surface-variant">
              <span className="text-display-lg text-secondary tabular-nums">
                {sharedPercent}%
              </span>
              <span className="ml-sm">of expenses were shared this month.</span>
            </p>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 md:col-span-4">
          <MetricCard label="Income this month" value={formatCurrency(snapshot.monthIncome)} />
        </div>
        <div className="col-span-12 md:col-span-4">
          <MetricCard label="Expenses this month" value={formatCurrency(snapshot.monthExpenses)} />
        </div>
        <div className="col-span-12 md:col-span-4">
          <MetricCard label="Uncategorized" value={String(snapshot.uncategorizedCount)} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 xl:col-span-7">
          <Card>
            <h3 className="text-headline-sm text-on-surface">How spending is split</h3>
            <div className="mt-md grid gap-md md:grid-cols-2">
              <SplitPanel
                title="Shared household expenses"
                value={formatCurrency(snapshot.sharedExpenses)}
                detail="Common groceries, rent, utilities, eating out and other shared costs."
              />
              <SplitPanel
                title="Personal expenses"
                value={formatCurrency(snapshot.personalExpenses)}
                detail="Private spend assigned to the signed-in user or demo personal accounts."
              />
            </div>

            <h4 className="mt-lg text-label-md text-secondary uppercase tracking-wider">
              Top expense categories this month
            </h4>
            <ul className="mt-md space-y-sm">
              {snapshot.topCategories.map((category) => (
                <li
                  key={category.name}
                  className="flex items-center justify-between bg-surface-container-low rounded-lg px-md py-sm text-body-sm"
                >
                  <span className="text-on-surface">{category.name}</span>
                  <strong className="text-on-surface tabular-nums">
                    {formatCurrency(category.amount)}
                  </strong>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-5">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Imported accounts</h3>
            <ul className="mt-md space-y-sm">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  className="bg-surface-container-low rounded-lg px-md py-sm"
                >
                  <div className="text-body-sm font-semibold text-on-surface">
                    {account.name}
                  </div>
                  <div className="text-body-sm text-on-surface-variant">
                    {account.visibilityOwnerType === "SHARED"
                      ? "Shared account"
                      : "Private account"}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card>
        <h3 className="text-headline-sm text-on-surface mb-md">Recent movements</h3>
        <DataTable
          columns={[
            {
              key: "date",
              header: "Date",
              render: (t) => t.bookingDate.toISOString().slice(0, 10),
            },
            { key: "account", header: "Account", render: (t) => t.accountName },
            {
              key: "counterparty",
              header: "Counterparty",
              render: (t) => t.counterpartyName ?? "—",
            },
            { key: "purpose", header: "Purpose", render: (t) => t.purposeRaw },
            {
              key: "category",
              header: "Category",
              render: (t) => t.categoryName ?? "Uncategorized",
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              tabularNums: true,
              render: (t) => <strong>{formatCurrency(t.amount)}</strong>,
            },
          ]}
          rows={snapshot.recentTransactions.slice(0, 10)}
          getRowKey={(t) =>
            `${t.accountName}-${t.bookingDate.toISOString()}-${t.purposeRaw}`
          }
          emptyState="No movements this month yet."
        />
      </Card>
    </>
  );
}

function SplitPanel({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-surface-container-low rounded-lg p-md">
      <p className="text-body-sm text-on-surface-variant">{title}</p>
      <p className="mt-xs text-headline-sm text-on-surface tabular-nums">{value}</p>
      <p className="mt-sm text-body-sm text-on-surface-variant">{detail}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
