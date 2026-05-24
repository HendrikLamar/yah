"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { deleteCategoryAction, updateCategoryAction } from "./actions";

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

type Props = {
  category: CategoryRowData;
  parentOptions: Array<{ id: string; label: string }>;
};

const PERIOD_LABEL: Record<"MONTHLY" | "QUARTERLY" | "YEARLY", string> = {
  MONTHLY: "Monatlich",
  QUARTERLY: "Quartal",
  YEARLY: "Jahr",
};

const FIELD =
  "px-sm py-xs bg-surface border border-outline-variant rounded-md text-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none";

export function CategoryRow({ category, parentOptions }: Props) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <tr className={category.isArchived ? "opacity-60" : ""}>
        <td className="px-md py-sm">
          <div className="flex items-center gap-sm">
            {category.color ? (
              <span
                aria-hidden
                className="w-3 h-3 rounded-full border border-outline-variant"
                style={{ background: category.color }}
              />
            ) : null}
            <span className="text-body-sm text-on-surface">{category.name}</span>
          </div>
        </td>
        <td className="px-md py-sm text-body-sm text-on-surface-variant">{category.slug}</td>
        <td className="px-md py-sm">
          {category.isSystem ? (
            <Badge variant="info" icon="label">
              System
            </Badge>
          ) : (
            <Badge variant="neutral">Custom</Badge>
          )}
        </td>
        <td className="px-md py-sm text-body-sm text-on-surface">
          {category.limitAmount !== null && category.limitPeriod ? (
            <span>
              {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
                category.limitAmount,
              )}{" "}
              · {PERIOD_LABEL[category.limitPeriod]}
              {category.limitRollover ? " · Roll-over" : ""}
            </span>
          ) : (
            <span className="text-on-surface-variant">—</span>
          )}
        </td>
        <td className="px-md py-sm">
          {category.isArchived ? (
            <Badge variant="neutral" icon="cancel">
              archiviert
            </Badge>
          ) : (
            <Badge variant="success" icon="check_circle">
              aktiv
            </Badge>
          )}
        </td>
        <td className="px-md py-sm text-right text-body-sm text-on-surface tabular-nums">
          {category.transactionCount}
        </td>
        <td className="px-md py-sm text-right">
          <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(true)}>
            Bearbeiten
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-surface-container-low">
      <td colSpan={7} className="px-md py-md">
        <form action={updateCategoryAction} className="grid grid-cols-12 gap-md">
          <input type="hidden" name="id" value={category.id} />
          <div className="col-span-12 md:col-span-3">
            <label className="block text-label-md text-on-surface-variant uppercase tracking-wider mb-xs">
              Name {category.isSystem ? "(gesperrt)" : ""}
            </label>
            <input
              name="name"
              defaultValue={category.name}
              disabled={category.isSystem}
              className={`${FIELD} w-full`}
            />
          </div>

          <div className="col-span-12 md:col-span-2">
            <label className="block text-label-md text-on-surface-variant uppercase tracking-wider mb-xs">
              Farbe
            </label>
            <input
              name="color"
              type="color"
              defaultValue={category.color ?? "#3b82f6"}
              className="w-full h-10"
            />
          </div>

          <div className="col-span-12 md:col-span-3">
            <label className="block text-label-md text-on-surface-variant uppercase tracking-wider mb-xs">
              Übergeordnet
            </label>
            <select
              name="parentId"
              defaultValue={category.parentId ?? "none"}
              className={`${FIELD} w-full`}
            >
              <option value="none">Keine</option>
              {parentOptions
                .filter((opt) => opt.id !== category.id)
                .map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
            </select>
          </div>

          <div className="col-span-12 md:col-span-2">
            <label className="block text-label-md text-on-surface-variant uppercase tracking-wider mb-xs">
              Budget (€)
            </label>
            <input
              name="limitAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={category.limitAmount ?? ""}
              className={`${FIELD} w-full`}
            />
          </div>

          <div className="col-span-12 md:col-span-2">
            <label className="block text-label-md text-on-surface-variant uppercase tracking-wider mb-xs">
              Zeitraum
            </label>
            <select
              name="limitPeriod"
              defaultValue={category.limitPeriod ?? "MONTHLY"}
              className={`${FIELD} w-full`}
            >
              <option value="MONTHLY">Monat</option>
              <option value="QUARTERLY">Quartal</option>
              <option value="YEARLY">Jahr</option>
            </select>
          </div>

          <label className="col-span-6 md:col-span-3 flex items-center gap-sm">
            <input
              type="checkbox"
              name="limitRollover"
              defaultChecked={category.limitRollover}
            />
            <span className="text-body-sm text-on-surface">Roll-over</span>
          </label>

          <label className="col-span-6 md:col-span-3 flex items-center gap-sm">
            <input
              type="checkbox"
              name="archive"
              value="true"
              defaultChecked={category.isArchived}
            />
            <span className="text-body-sm text-on-surface">archiviert</span>
          </label>

          <div className="col-span-12 flex justify-end gap-sm">
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Abbrechen
            </Button>
            <Button type="submit" size="sm" variant="secondary" icon="check_circle">
              Speichern
            </Button>
          </div>
        </form>

        {!category.isSystem &&
        category.transactionCount === 0 &&
        category.ruleCount === 0 ? (
          <form action={deleteCategoryAction} className="mt-sm flex justify-end">
            <input type="hidden" name="id" value={category.id} />
            <Button type="submit" size="sm" variant="ghost">
              Löschen
            </Button>
          </form>
        ) : null}
      </td>
    </tr>
  );
}
