"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { createRuleAction, updateRuleAction } from "./actions";

export type CategoryOption = { id: string; name: string };
export type AccountOption = { id: string; label: string };

type Props = {
  mode: "create" | "edit";
  categories: CategoryOption[];
  accounts: AccountOption[];
  initial?: {
    id: string;
    name: string;
    priority: number;
    matchField: string;
    matchOperator: string;
    matchValue: string;
    actionCategoryId: string | null;
    actionResponsibilityType: string | null;
    actionMarkTransfer: boolean;
    accountId: string | null;
  };
};

const INPUT_CLASS =
  "w-full px-md py-sm bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-body-md text-on-surface";

const MATCH_FIELDS = [
  ["PURPOSE_RAW", "Verwendungszweck"],
  ["COUNTERPARTY_NAME", "Auftraggeber / Empfänger"],
  ["NORMALIZED_MERCHANT", "Normalisierter Händler"],
  ["AMOUNT", "Betrag"],
  ["DIRECTION", "Richtung (INCOME / EXPENSE)"],
  ["ACCOUNT_ID", "Konto-ID"],
] as const;

const MATCH_OPERATORS = [
  ["CONTAINS", "enthält"],
  ["EQUALS", "ist gleich"],
  ["STARTS_WITH", "beginnt mit"],
  ["REGEX", "Regex"],
  ["AMOUNT_GT", "Betrag > Schwelle"],
  ["AMOUNT_LT", "Betrag < Schwelle"],
] as const;

export function RuleForm({ mode, categories, accounts, initial }: Props) {
  const action = mode === "edit" ? updateRuleAction : createRuleAction;

  const [matchField, setMatchField] = useState(initial?.matchField ?? "PURPOSE_RAW");
  const [matchOperator, setMatchOperator] = useState(
    initial?.matchOperator ?? "CONTAINS",
  );

  return (
    <form action={action} className="space-y-md">
      {mode === "edit" && initial ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <Field label="Name">
          <input
            name="name"
            required
            defaultValue={initial?.name ?? ""}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Priorität (kleiner = früher)">
          <input
            name="priority"
            type="number"
            defaultValue={initial?.priority ?? 100}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        <Field label="Feld">
          <select
            name="matchField"
            value={matchField}
            onChange={(e) => setMatchField(e.target.value)}
            className={INPUT_CLASS}
          >
            {MATCH_FIELDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Operator">
          <select
            name="matchOperator"
            value={matchOperator}
            onChange={(e) => setMatchOperator(e.target.value)}
            className={INPUT_CLASS}
          >
            {MATCH_OPERATORS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={
            matchOperator === "AMOUNT_GT" || matchOperator === "AMOUNT_LT"
              ? "Schwelle (€)"
              : matchOperator === "REGEX"
                ? "Regex-Muster"
                : "Wert"
          }
        >
          <input
            name="matchValue"
            required
            defaultValue={initial?.matchValue ?? ""}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        <Field label="Aktion → Kategorie">
          <select
            name="actionCategoryId"
            defaultValue={initial?.actionCategoryId ?? ""}
            className={INPUT_CLASS}
          >
            <option value="">(keine Änderung)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Aktion → Verantwortlichkeit">
          <select
            name="actionResponsibilityType"
            defaultValue={initial?.actionResponsibilityType ?? ""}
            className={INPUT_CLASS}
          >
            <option value="">(keine Änderung)</option>
            <option value="SHARED">Geteilt</option>
            <option value="USER">Privat</option>
          </select>
        </Field>
        <Field label="Konto-Geltungsbereich (optional)">
          <select
            name="accountId"
            defaultValue={initial?.accountId ?? ""}
            className={INPUT_CLASS}
          >
            <option value="">(alle Konten)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="flex items-center gap-sm text-body-sm text-on-surface">
        <input
          type="checkbox"
          name="actionMarkTransfer"
          defaultChecked={initial?.actionMarkTransfer ?? false}
        />
        Als interne Umbuchung markieren (von Einnahmen/Ausgaben ausschließen)
      </label>

      <Button variant="primary" type="submit" icon={mode === "edit" ? "rule" : "rule"}>
        {mode === "edit" ? "Regel speichern" : "Regel anlegen"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-body-sm text-on-surface">
      <span className="block mb-xs">{label}</span>
      {children}
    </label>
  );
}
