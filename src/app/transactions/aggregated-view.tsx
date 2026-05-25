import { formatCurrency, formatNumber } from "@/lib/format";
import type { AggregatedRow } from "@/lib/search/transaction-search-queries";

type Props = {
  rows: AggregatedRow[];
  groupLabel: string;
};

export function AggregatedView({ rows, groupLabel }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-outline-variant py-xl text-center">
        <p className="text-body-sm text-on-surface-variant">
          Keine Treffer für die aktuelle Filterkombination.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="bg-surface-container-low">
          <tr>
            <th className="text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm text-left">
              {groupLabel}
            </th>
            <th className="text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm text-right">
              Einnahmen
            </th>
            <th className="text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm text-right">
              Ausgaben
            </th>
            <th className="text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm text-right">
              Netto
            </th>
            <th className="text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm text-right">
              Buchungen
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="px-md py-sm text-body-sm text-on-surface">
                {row.label}
              </td>
              <td className="px-md py-sm text-body-sm text-on-surface text-right tabular-nums">
                {formatCurrency(row.income)}
              </td>
              <td className="px-md py-sm text-body-sm text-on-surface text-right tabular-nums">
                {formatCurrency(row.expense)}
              </td>
              <td
                className={[
                  "px-md py-sm text-body-sm text-right tabular-nums",
                  row.total < 0 ? "text-error" : "text-secondary",
                ].join(" ")}
              >
                <strong>{formatCurrency(row.total)}</strong>
              </td>
              <td className="px-md py-sm text-body-sm text-on-surface text-right tabular-nums">
                {formatNumber(row.count)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
