"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

type FilterOption = { value: string; label: string };

type Props = {
  accountOptions: FilterOption[];
  categoryOptions: FilterOption[];
};

const PRESETS = [
  { label: "Dieser Monat", months: 0 },
  { label: "Letzte 3M", months: 3 },
  { label: "YTD", months: -1 },
  { label: "Letzte 12M", months: 12 },
  { label: "Alle", months: null as number | null },
];

export function FilterPanel({ accountOptions, categoryOptions }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const direction = params.get("direction") ?? "";
  const responsibility = params.get("responsibility") ?? "";
  const minAmount = params.get("minAmount") ?? "";
  const maxAmount = params.get("maxAmount") ?? "";
  const includeTransfers = params.get("includeTransfers") === "true";
  const accountSelected = params.getAll("account");
  const categorySelected = params.getAll("category");

  function update(updates: Record<string, string | null | string[]>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      next.delete(key);
      if (value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) next.append(key, v);
      } else if (value !== "") {
        next.set(key, value);
      }
    }
    next.delete("page");
    router.push(`?${next.toString()}`);
  }

  function applyPreset(months: number | null) {
    if (months === null) {
      update({ from: null, to: null });
      return;
    }
    const now = new Date();
    const toDate = now.toISOString().slice(0, 10);
    let fromDate: string;
    if (months === 0) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      fromDate = d.toISOString().slice(0, 10);
    } else if (months === -1) {
      fromDate = `${now.getUTCFullYear()}-01-01`;
    } else {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1),
      );
      fromDate = d.toISOString().slice(0, 10);
    }
    update({ from: fromDate, to: toDate });
  }

  function toggleMulti(key: string, value: string, current: string[]) {
    const next = current.includes(value)
      ? current.filter((c) => c !== value)
      : [...current, value];
    update({ [key]: next });
  }

  const inputCls =
    "w-full px-sm py-xs bg-surface border border-outline-variant rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none text-body-sm text-on-surface";
  const labelCls = "text-label-md text-on-surface-variant uppercase tracking-wider mb-xs block";

  return (
    <div className="space-y-md">
      <div>
        <div className="flex flex-wrap items-center gap-xs">
          <span className="text-label-md text-on-surface-variant uppercase tracking-wider">
            Zeitraum
          </span>
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => applyPreset(p.months)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="mt-sm grid grid-cols-2 gap-sm">
          <label className="block">
            <span className={labelCls}>Von</span>
            <input
              type="date"
              value={from}
              onChange={(e) => update({ from: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Bis</span>
            <input
              type="date"
              value={to}
              onChange={(e) => update({ to: e.target.value })}
              className={inputCls}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
        <label className="block">
          <span className={labelCls}>Richtung</span>
          <select
            value={direction}
            onChange={(e) => update({ direction: e.target.value })}
            className={inputCls}
          >
            <option value="">Alle</option>
            <option value="EXPENSE">Ausgaben</option>
            <option value="INCOME">Einnahmen</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Verantwortlich</span>
          <select
            value={responsibility}
            onChange={(e) => update({ responsibility: e.target.value })}
            className={inputCls}
          >
            <option value="">Alle</option>
            <option value="SHARED">Gemeinsam</option>
            <option value="USER">Privat</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-sm">
        <label className="block">
          <span className={labelCls}>Betrag min (€)</span>
          <input
            type="number"
            step="0.01"
            value={minAmount}
            onChange={(e) => update({ minAmount: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Betrag max (€)</span>
          <input
            type="number"
            step="0.01"
            value={maxAmount}
            onChange={(e) => update({ maxAmount: e.target.value })}
            className={inputCls}
          />
        </label>
      </div>

      <label className="flex items-center gap-sm">
        <input
          type="checkbox"
          checked={includeTransfers}
          onChange={(e) => update({ includeTransfers: e.target.checked ? "true" : null })}
        />
        <span className="text-body-sm text-on-surface">
          Eigene Umbuchungen mit anzeigen
        </span>
      </label>

      {accountOptions.length > 0 ? (
        <div>
          <span className={labelCls}>Konten</span>
          <div className="flex flex-wrap gap-xs">
            {accountOptions.map((opt) => {
              const active = accountSelected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleMulti("account", opt.value, accountSelected)}
                  className={[
                    "px-sm py-xs rounded-full text-body-sm border transition-colors",
                    active
                      ? "bg-secondary-container text-on-secondary-container border-secondary"
                      : "bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-low",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {categoryOptions.length > 0 ? (
        <div>
          <span className={labelCls}>Kategorien</span>
          <div className="flex flex-wrap gap-xs">
            {categoryOptions.map((opt) => {
              const active = categorySelected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleMulti("category", opt.value, categorySelected)}
                  className={[
                    "px-sm py-xs rounded-full text-body-sm border transition-colors",
                    active
                      ? "bg-secondary-container text-on-secondary-container border-secondary"
                      : "bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-low",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
