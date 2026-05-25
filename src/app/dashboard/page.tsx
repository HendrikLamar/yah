import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { buildHouseholdSnapshot } from "@/lib/analysis/household-snapshot";
import {
  aggregateCashflowByPeriod,
  aggregateCategorySpend,
  aggregateIncomeComposition,
  aggregateSavingsRateOverTime,
  aggregateTopCounterparties,
  defaultRange,
  parseGranularity,
  parseRange,
  type AnalysisTransaction,
} from "@/lib/analysis/timeseries";
import {
  evaluateHouseholdBudgets,
  listUnacknowledgedAlerts,
} from "@/lib/budgets/evaluation";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency, formatDateRange, formatIsoDate } from "@/lib/format";
import {
  buildAccountVisibilityFilter,
  buildTransactionAccountVisibilityFilter,
  getViewerHouseholdContext,
} from "@/lib/household/viewer";

import { BudgetOverview } from "./budget-overview";
import { CashflowChart } from "./cashflow-chart";
import { CategorySpendChart } from "./category-spend-chart";
import { CounterpartiesChart } from "./counterparties-chart";
import { IncomeCompositionChart } from "./income-composition-chart";
import { SavingsRateChart } from "./savings-rate-chart";
import { TimeRangePicker } from "./time-range-picker";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const context = await getViewerHouseholdContext();
  const resolved = searchParams ? await searchParams : {};

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );

  const range = parseRange(firstValue(resolved.from), firstValue(resolved.to), now);
  const granularity = parseGranularity(firstValue(resolved.granularity));

  const budgetEval = await evaluateHouseholdBudgets({ householdId: context.householdId });
  const budgetAlerts = await listUnacknowledgedAlerts(context.householdId);

  const [accounts, monthTransactions, rangeTransactions, previousWindowTransactions] = await Promise.all([
    prisma.account.findMany({
      where: {
        householdId: context.householdId,
        isActive: true,
        ...buildAccountVisibilityFilter(context.viewer),
      },
      select: { id: true, name: true, visibilityOwnerType: true },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: context.householdId,
        bookingDate: { gte: monthStart, lte: monthEnd },
        ...buildTransactionAccountVisibilityFilter(context.viewer),
      },
      select: {
        id: true,
        bookingDate: true,
        amount: true,
        direction: true,
        responsibilityType: true,
        purposeRaw: true,
        counterpartyName: true,
        isInternalTransfer: true,
        account: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { bookingDate: "desc" },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: context.householdId,
        bookingDate: { gte: range.from, lte: range.to },
        ...buildTransactionAccountVisibilityFilter(context.viewer),
      },
      select: {
        bookingDate: true,
        amount: true,
        direction: true,
        counterpartyName: true,
        isInternalTransfer: true,
        purposeRaw: true,
        category: { select: { name: true } },
      },
      orderBy: { bookingDate: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: context.householdId,
        bookingDate: {
          gte: previousWindow(range).from,
          lte: previousWindow(range).to,
        },
        ...buildTransactionAccountVisibilityFilter(context.viewer),
      },
      select: {
        bookingDate: true,
        amount: true,
        direction: true,
        counterpartyName: true,
        isInternalTransfer: true,
      },
    }),
  ]);

  const analysisTransactions: AnalysisTransaction[] = rangeTransactions.map((t) => ({
    bookingDate: t.bookingDate,
    amount: Number(t.amount),
    direction: t.direction,
    counterpartyName: t.counterpartyName,
    isInternalTransfer: t.isInternalTransfer,
    categoryName: t.category?.name ?? null,
    purposeRawSearchHint: t.purposeRaw,
  }));

  const previousWindowAnalysis: AnalysisTransaction[] = previousWindowTransactions.map((t) => ({
    bookingDate: t.bookingDate,
    amount: Number(t.amount),
    direction: t.direction,
    counterpartyName: t.counterpartyName,
    isInternalTransfer: t.isInternalTransfer,
  }));

  const cashflow = aggregateCashflowByPeriod(analysisTransactions, granularity);
  const topCounterparties = aggregateTopCounterparties(
    [...analysisTransactions, ...previousWindowAnalysis],
    10,
    range,
  );
  const categoryPivot = aggregateCategorySpend(analysisTransactions, granularity, 6);
  const incomeComposition = aggregateIncomeComposition(analysisTransactions, undefined, granularity);
  const savingsRate = aggregateSavingsRateOverTime(analysisTransactions);

  const snapshot = buildHouseholdSnapshot(
    monthTransactions.map((transaction) => ({
      id: transaction.id,
      bookingDate: transaction.bookingDate,
      amount: Number(transaction.amount),
      direction: transaction.direction,
      categoryName: transaction.category?.name ?? null,
      responsibilityType: transaction.responsibilityType,
      accountName: transaction.account.name,
      purposeRaw: transaction.purposeRaw,
      counterpartyName: transaction.counterpartyName,
      isInternalTransfer: transaction.isInternalTransfer,
    })),
    now,
  );

  const monthRangeLabel = formatDateRange(snapshot.monthRangeStart, snapshot.monthRangeEnd);
  const partialMonthHint = snapshot.isPartialMonth
    ? `Partial month — ${monthRangeLabel}`
    : monthRangeLabel;

  const totalExpenses = snapshot.sharedExpenses + snapshot.personalExpenses;
  const sharedPercent =
    totalExpenses > 0 ? Math.round((snapshot.sharedExpenses / totalExpenses) * 100) : 0;

  const fallback = defaultRange(now);
  const rangeLabel = `${formatIsoDate(range.from)} → ${formatIsoDate(range.to)}`;
  const usingDefaultRange =
    range.from.getTime() === fallback.from.getTime() &&
    range.to.getTime() === fallback.to.getTime();

  const uncategorizedDominant = categoryPivot.uncategorizedShare >= 0.5;

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

      <div className="mb-lg">
        <BudgetOverview evaluations={budgetEval.evaluations} alerts={budgetAlerts} />
      </div>

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 md:col-span-6">
          <MetricCard
            hero
            label="Net this month"
            value={formatCurrency(snapshot.monthNet)}
            helper={partialMonthHint}
          />
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
        <div className="col-span-12 md:col-span-3">
          <MetricCard
            label="Income this month"
            value={formatCurrency(snapshot.monthIncome)}
            helper={monthRangeLabel}
          />
        </div>
        <div className="col-span-12 md:col-span-3">
          <MetricCard
            label="Expenses this month"
            value={formatCurrency(snapshot.monthExpenses)}
            helper={monthRangeLabel}
          />
        </div>
        <div className="col-span-12 md:col-span-3">
          <MetricCard
            label="Moved between own accounts"
            value={formatCurrency(snapshot.transferVolume)}
            helper="Excluded from income/expense"
          />
        </div>
        <div className="col-span-12 md:col-span-3">
          <MetricCard label="Uncategorized" value={String(snapshot.uncategorizedCount)} />
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-md mb-md">
          <div>
            <h3 className="text-headline-sm text-on-surface">Cashflow über Zeit</h3>
            <p className="text-body-sm text-on-surface-variant">
              {usingDefaultRange ? "Letzte 12 Monate (Standard)" : rangeLabel}
            </p>
          </div>
          <TimeRangePicker />
        </div>
        <CashflowChart data={cashflow} granularity={granularity} />
      </Card>

      <div className="grid grid-cols-12 gap-gutter my-lg">
        <div className="col-span-12">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-md mb-md">
              <div>
                <h3 className="text-headline-sm text-on-surface">Ausgaben nach Kategorie</h3>
                <p className="text-body-sm text-on-surface-variant">
                  Top-Kategorien gestapelt im Zeitraum
                </p>
              </div>
              {uncategorizedDominant ? (
                <Badge variant="info" icon="insights">
                  Viele Buchungen unkategorisiert — Regeln auf /rules definieren.
                </Badge>
              ) : null}
            </div>
            <CategorySpendChart pivot={categoryPivot} />
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-gutter my-lg">
        <div className="col-span-12 xl:col-span-7">
          <Card>
            <h3 className="text-headline-sm text-on-surface mb-md">
              Top-Empfänger im Zeitraum
            </h3>
            <CounterpartiesChart data={topCounterparties} range={range} />
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

      <div className="grid grid-cols-12 gap-gutter my-lg">
        <div className="col-span-12 xl:col-span-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface mb-md">Einkommens-Zusammensetzung</h3>
            <IncomeCompositionChart data={incomeComposition} />
          </Card>
        </div>
        <div className="col-span-12 xl:col-span-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface mb-md">Netto &amp; Sparquote</h3>
            <SavingsRateChart data={savingsRate} />
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
              render: (t) => formatIsoDate(t.bookingDate),
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
          getRowKey={(t) => t.id}
          emptyState="No movements this month yet."
        />
      </Card>
    </>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function previousWindow(range: { from: Date; to: Date }): { from: Date; to: Date } {
  const durationMs = Math.max(0, range.to.getTime() - range.from.getTime());
  const to = new Date(range.from.getTime() - 1);
  const from = new Date(to.getTime() - durationMs);
  return { from, to };
}
