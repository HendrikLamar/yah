import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatIsoDate } from "@/lib/format";
import type { EvaluatedLimit } from "@/lib/budgets/evaluation";

type Alert = {
  id: string;
  categoryId: string;
  threshold: { toString(): string } | number;
  category: { id: string; name: string; slug: string };
  spentAmount: { toString(): string } | number;
  limitAmount: { toString(): string } | number;
  periodStart: Date;
  periodEnd: Date;
};

type Props = {
  evaluations: EvaluatedLimit[];
  alerts: Alert[];
};

export function BudgetOverview({ evaluations, alerts }: Props) {
  if (evaluations.length === 0 && alerts.length === 0) return null;

  const ranked = evaluations
    .slice()
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 6);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-md mb-md">
        <div>
          <h3 className="text-headline-sm text-on-surface">
            Kategorien an oder über Limit
          </h3>
          <p className="text-body-sm text-on-surface-variant">
            Schwellen 80% / 100% / 120% lösen Hinweise aus.
          </p>
        </div>
        {alerts.length > 0 ? (
          <Badge variant="error" icon="error">
            {alerts.length} aktive Hinweise
          </Badge>
        ) : null}
      </div>

      {ranked.length > 0 ? (
        <ul className="space-y-sm">
          {ranked.map((row) => {
            const pct = Math.min(150, row.ratio * 100);
            const barColor =
              row.ratio >= 1 ? "bg-error" : row.ratio >= 0.8 ? "bg-tertiary" : "bg-secondary";
            const remaining = row.effectiveLimit - row.spent;
            const drillHref = `/transactions?from=${formatIsoDate(row.periodStart)}&to=${formatIsoDate(row.periodEnd)}&category=${encodeURIComponent(row.categorySlug)}&sort=amountAbs.desc&direction=EXPENSE`;
            return (
              <li
                key={row.categoryId}
                className="rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-sm">
                  <Link
                    href={drillHref}
                    className="text-body-md text-on-surface font-semibold hover:underline"
                  >
                    {row.categoryName}
                  </Link>
                  <span className="text-body-sm text-on-surface-variant tabular-nums">
                    {formatCurrency(row.spent)} / {formatCurrency(row.effectiveLimit)}
                    {remaining >= 0 ? ` · ${formatCurrency(remaining)} übrig` : ` · ${formatCurrency(-remaining)} drüber`}
                  </span>
                </div>
                <div className="mt-xs h-2 w-full rounded-full bg-surface overflow-hidden">
                  <div
                    className={`${barColor} h-full transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-body-sm text-on-surface-variant">
          Keine Budgets gesetzt — Limits unter /categories einrichten.
        </p>
      )}
    </Card>
  );
}
