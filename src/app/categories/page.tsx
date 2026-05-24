import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  evaluateHouseholdBudgets,
  listUnacknowledgedAlerts,
} from "@/lib/budgets/evaluation";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency, formatIsoDate } from "@/lib/format";
import { getViewerHouseholdContext } from "@/lib/household/viewer";

import { acknowledgeAlertsAction } from "./actions";
import { CategoryForm } from "./category-form";
import { CategoryRow } from "./category-row";

const KIND_LABEL: Record<"INCOME" | "EXPENSE" | "TRANSFER", string> = {
  INCOME: "Einnahmen",
  EXPENSE: "Ausgaben",
  TRANSFER: "Umbuchungen",
};

type CategoryRowData = {
  id: string;
  name: string;
  slug: string;
  kind: "INCOME" | "EXPENSE" | "TRANSFER";
  color: string | null;
  isSystem: boolean;
  isArchived: boolean;
  limitAmount: number | null;
  limitPeriod: "MONTHLY" | "QUARTERLY" | "YEARLY" | null;
  limitRollover: boolean;
  parentId: string | null;
  transactionCount: number;
  ruleCount: number;
};

type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  kind: "INCOME" | "EXPENSE" | "TRANSFER";
  color: string | null;
  isSystem: boolean;
  isArchived: boolean;
  parentId: string | null;
  limitAmount: { toString(): string } | null;
  limitPeriod: "MONTHLY" | "QUARTERLY" | "YEARLY" | null;
  limitRollover: boolean;
  _count: { transactions: number; rules: number };
};

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CategoriesPage({ searchParams }: Props) {
  const context = await getViewerHouseholdContext();
  const resolved = searchParams ? await searchParams : {};
  const ok = firstValue(resolved.ok);
  const error = firstValue(resolved.error);

  // Re-evaluate on every page load — cheap, keeps alerts current.
  await evaluateHouseholdBudgets({ householdId: context.householdId });

  const [categoriesRaw, alerts] = await Promise.all([
    prisma.category.findMany({
      where: { householdId: context.householdId },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        kind: true,
        color: true,
        isSystem: true,
        isArchived: true,
        parentId: true,
        limitAmount: true,
        limitPeriod: true,
        limitRollover: true,
        _count: { select: { transactions: true, rules: true } },
      },
    }),
    listUnacknowledgedAlerts(context.householdId),
  ]);

  const categories = (categoriesRaw as unknown as CategoryRecord[]).map((c): CategoryRowData => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    kind: c.kind,
    color: c.color,
    isSystem: c.isSystem,
    isArchived: c.isArchived,
    limitAmount: c.limitAmount === null ? null : Number(c.limitAmount),
    limitPeriod: c.limitPeriod,
    limitRollover: c.limitRollover,
    parentId: c.parentId,
    transactionCount: c._count.transactions,
    ruleCount: c._count.rules,
  }));

  const parentOptions = categories
    .filter((c) => !c.isArchived)
    .map((c) => ({ id: c.id, label: `${KIND_LABEL[c.kind]} · ${c.name}` }));

  const grouped = new Map<"INCOME" | "EXPENSE" | "TRANSFER", CategoryRowData[]>();
  for (const category of categories) {
    const arr = grouped.get(category.kind) ?? [];
    arr.push(category);
    grouped.set(category.kind, arr);
  }

  return (
    <>
      <PageHeader
        eyebrow="categories"
        title="Kategorien, Hierarchie und Budgets"
        description="Custom-Kategorien anlegen, Systemkategorien einfärben, Budgets pro Zeitraum setzen. Schwellen 80% / 100% / 120% lösen In-App Benachrichtigungen aus."
      />

      {error ? (
        <div className="mb-md">
          <Badge variant="error" icon="error">
            {error}
          </Badge>
        </div>
      ) : null}
      {ok ? (
        <div className="mb-md">
          <Badge variant="success" icon="check_circle">
            {ok}
          </Badge>
        </div>
      ) : null}

      {alerts.length > 0 ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-md">
            <div>
              <h3 className="text-headline-sm text-on-surface mb-xs">
                Aktive Budget-Hinweise
              </h3>
              <p className="text-body-sm text-on-surface-variant">
                {alerts.length} unbestätigte Schwellen-Überschreitungen
              </p>
            </div>
            <form action={acknowledgeAlertsAction}>
              {alerts.map((a) => (
                <input key={a.id} type="hidden" name="alertId" value={a.id} />
              ))}
              <button
                type="submit"
                className="px-md py-sm rounded-md border border-outline-variant text-body-sm hover:bg-surface-container-low"
              >
                Alle bestätigen
              </button>
            </form>
          </div>
          <ul className="mt-md space-y-sm">
            {alerts.map((alert) => {
              const threshold = Number(alert.threshold);
              const spent = Number(alert.spentAmount);
              const limit = Number(alert.limitAmount);
              return (
                <li
                  key={alert.id}
                  className="rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-sm">
                    <span className="text-body-md text-on-surface">
                      <strong>{alert.category.name}</strong> · {(threshold * 100).toFixed(0)}%
                      Schwelle überschritten
                    </span>
                    <span className="text-body-sm text-on-surface-variant tabular-nums">
                      {formatCurrency(spent)} / {formatCurrency(limit)} ·{" "}
                      {formatIsoDate(alert.periodStart)} →{" "}
                      {formatIsoDate(alert.periodEnd)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <div className="grid grid-cols-12 gap-gutter my-lg">
        <div className="col-span-12 lg:col-span-5">
          <Card>
            <h3 className="text-headline-sm text-on-surface mb-md">
              Neue Custom-Kategorie
            </h3>
            <CategoryForm parentOptions={parentOptions} />
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-7 space-y-md">
          {Array.from(grouped.entries()).map(([kind, items]) => (
            <Card key={kind}>
              <h3 className="text-headline-sm text-on-surface mb-md">
                {KIND_LABEL[kind]}
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-surface-container-low">
                    <tr>
                      <th className="text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm text-left">
                        Name
                      </th>
                      <th className="text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm text-left">
                        Slug
                      </th>
                      <th className="text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm text-left">
                        Typ
                      </th>
                      <th className="text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm text-left">
                        Budget
                      </th>
                      <th className="text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm text-left">
                        Status
                      </th>
                      <th className="text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm text-right">
                        Tx
                      </th>
                      <th className="text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {items.map((category) => (
                      <CategoryRow
                        key={category.id}
                        category={category}
                        parentOptions={parentOptions}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
