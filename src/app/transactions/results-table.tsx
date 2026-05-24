"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatIsoDate } from "@/lib/format";
import type {
  SearchResultRow,
  SearchSummary,
} from "@/lib/search/transaction-search-queries";
import type { SortKey, SortSpec } from "@/lib/search/transaction-search";

type Props = {
  rows: SearchResultRow[];
  summary: SearchSummary;
  sort: SortSpec;
  page: number;
  pageSize: number;
  totalPages: number;
};

const COLUMNS: Array<{ key: SortKey; label: string; align?: "right" }> = [
  { key: "bookingDate", label: "Datum" },
  { key: "account", label: "Konto" },
  { key: "counterpartyName", label: "Empfänger" },
  { key: "purposeRaw", label: "Verwendungszweck" },
  { key: "category", label: "Kategorie" },
  { key: "responsibility", label: "Owner" },
  { key: "amount", label: "Betrag", align: "right" },
];

export function ResultsTable({ rows, summary, sort, page, pageSize, totalPages }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function changeSort(key: SortKey) {
    const next = new URLSearchParams(params.toString());
    const direction =
      sort.key === key && sort.direction === "desc" ? "asc" : "desc";
    next.set("sort", `${key}.${direction}`);
    next.delete("page");
    router.push(`?${next.toString()}`);
  }

  function goToPage(targetPage: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(targetPage));
    router.push(`?${next.toString()}`);
  }

  function sortIndicator(key: SortKey) {
    if (sort.key !== key) return null;
    return (
      <span aria-hidden className="ml-xs">
        {sort.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  return (
    <div className="space-y-md">
      <div className="flex flex-wrap items-baseline justify-between gap-sm bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm">
        <div className="flex flex-wrap items-baseline gap-md">
          <strong className="text-body-md text-on-surface tabular-nums">
            {summary.count.toLocaleString("de-DE")} Buchungen
          </strong>
          <span className="text-body-sm text-on-surface-variant tabular-nums">
            Einnahmen: <strong>{formatCurrency(summary.incomeTotal)}</strong>
          </span>
          <span className="text-body-sm text-on-surface-variant tabular-nums">
            Ausgaben: <strong>{formatCurrency(summary.expenseTotal)}</strong>
          </span>
          <span className="text-body-sm text-on-surface-variant tabular-nums">
            Netto:{" "}
            <strong
              className={summary.net < 0 ? "text-error" : "text-secondary"}
            >
              {formatCurrency(summary.net)}
            </strong>
          </span>
        </div>
        <Badge variant="neutral">
          Sortierung: {sort.key}.{sort.direction}
        </Badge>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-outline-variant py-xl text-center">
          <p className="text-body-sm text-on-surface-variant">
            Keine Treffer für die aktuelle Filterkombination. Eingrenzungen lockern
            (Zeitraum, Betragsgrenzen, Konten).
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-surface-container-low">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={[
                      "text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm",
                      col.align === "right" ? "text-right" : "text-left",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => changeSort(col.key)}
                      className="inline-flex items-center hover:text-on-surface"
                    >
                      {col.label}
                      {sortIndicator(col.key)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-surface-container-low transition-colors"
                >
                  <td className="px-md py-sm text-body-sm text-on-surface tabular-nums">
                    {formatIsoDate(row.bookingDate)}
                  </td>
                  <td className="px-md py-sm text-body-sm text-on-surface">
                    {row.account.name}
                  </td>
                  <td className="px-md py-sm text-body-sm text-on-surface">
                    {row.counterpartyName ?? "—"}
                  </td>
                  <td className="px-md py-sm text-body-sm text-on-surface">
                    {row.purposeRaw}
                  </td>
                  <td className="px-md py-sm text-body-sm text-on-surface">
                    {row.category?.name ?? (
                      <span className="text-on-surface-variant">Uncategorized</span>
                    )}
                  </td>
                  <td className="px-md py-sm text-body-sm text-on-surface">
                    {row.isInternalTransfer
                      ? "Umbuchung"
                      : row.responsibilityType === "SHARED"
                        ? "Gemeinsam"
                        : "Privat"}
                  </td>
                  <td className="px-md py-sm text-body-sm text-on-surface text-right tabular-nums">
                    <strong className={row.amount < 0 ? "text-error" : "text-secondary"}>
                      {formatCurrency(row.amount)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <span className="text-body-sm text-on-surface-variant">
            Seite {page} von {totalPages} · {pageSize} pro Seite
          </span>
          <div className="flex items-center gap-xs">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="px-md py-xs rounded-md border border-outline-variant disabled:opacity-50 hover:bg-surface-container-low"
            >
              Zurück
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="px-md py-xs rounded-md border border-outline-variant disabled:opacity-50 hover:bg-surface-container-low"
            >
              Weiter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

