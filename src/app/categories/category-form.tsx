"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { createCategoryAction } from "./actions";

type ParentOption = { id: string; label: string };

type Props = {
  parentOptions: ParentOption[];
};

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

const FIELD =
  "w-full px-md py-sm bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-body-sm text-on-surface";
const LABEL = "text-label-md text-on-surface-variant uppercase tracking-wider mb-xs block";

export function CategoryForm({ parentOptions }: Props) {
  const [color, setColor] = useState<string>(COLORS[0]);
  const [hasBudget, setHasBudget] = useState(false);

  return (
    <form action={createCategoryAction} className="space-y-md">
      <input type="hidden" name="color" value={color} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <label className="block">
          <span className={LABEL}>Name</span>
          <input name="name" required className={FIELD} />
        </label>
        <label className="block">
          <span className={LABEL}>Typ</span>
          <select name="kind" defaultValue="EXPENSE" className={FIELD}>
            <option value="EXPENSE">Ausgaben</option>
            <option value="INCOME">Einnahmen</option>
            <option value="TRANSFER">Umbuchung</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className={LABEL}>Übergeordnete Kategorie</span>
        <select name="parentId" defaultValue="none" className={FIELD}>
          <option value="none">Keine</option>
          {parentOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className={LABEL}>Farbe</span>
        <div className="flex flex-wrap gap-xs">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Farbe ${c}`}
              className={[
                "w-8 h-8 rounded-full border-2 transition-all",
                color === c ? "border-on-surface scale-110" : "border-outline-variant",
              ].join(" ")}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <label className="flex items-center gap-sm">
        <input
          type="checkbox"
          checked={hasBudget}
          onChange={(e) => setHasBudget(e.target.checked)}
        />
        <span className="text-body-sm text-on-surface">Budget setzen</span>
      </label>

      {hasBudget ? (
        <div className="grid grid-cols-3 gap-md">
          <label className="block">
            <span className={LABEL}>Betrag (€)</span>
            <input
              name="limitAmount"
              type="number"
              step="0.01"
              min="0.01"
              required={hasBudget}
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Zeitraum</span>
            <select name="limitPeriod" defaultValue="MONTHLY" className={FIELD}>
              <option value="MONTHLY">Monat</option>
              <option value="QUARTERLY">Quartal</option>
              <option value="YEARLY">Jahr</option>
            </select>
          </label>
          <label className="flex items-center gap-sm pt-lg">
            <input type="checkbox" name="limitRollover" />
            <span className="text-body-sm text-on-surface">Rest übernehmen</span>
          </label>
        </div>
      ) : null}

      <Button type="submit" variant="secondary" icon="check_circle">
        Kategorie anlegen
      </Button>
    </form>
  );
}
