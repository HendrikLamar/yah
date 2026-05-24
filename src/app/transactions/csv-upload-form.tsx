"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import { uploadCsvAction } from "./actions";

export type AccountOption = {
  id: string;
  label: string;
};

type Props = {
  accounts: AccountOption[];
  defaultNewAccountName: string;
};

const FIELD_INPUT_CLASS =
  "w-full pl-[48px] pr-md py-md bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-body-md text-on-surface";

export function CsvUploadForm({ accounts, defaultNewAccountName }: Props) {
  const hasAccounts = accounts.length > 0;
  const [mode, setMode] = useState<"existing" | "new">(hasAccounts ? "existing" : "new");

  return (
    <form action={uploadCsvAction} className="mt-md space-y-md">
      <input type="hidden" name="accountMode" value={mode} />

      {hasAccounts ? (
        <div
          role="radiogroup"
          aria-label="Account selection mode"
          className="inline-flex rounded-lg border border-outline-variant bg-surface-container-low p-1"
        >
          <ModeButton
            active={mode === "existing"}
            onClick={() => setMode("existing")}
            label="Existing account"
          />
          <ModeButton
            active={mode === "new"}
            onClick={() => setMode("new")}
            label="New account"
          />
        </div>
      ) : null}

      {mode === "existing" && hasAccounts ? (
        <label className="block text-body-sm text-on-surface">
          Account to import into
          <div className="mt-xs relative">
            <Icon
              name="account_balance"
              className="absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
            />
            <select
              name="accountId"
              required
              defaultValue={accounts[0]?.id}
              className={FIELD_INPUT_CLASS}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </div>
        </label>
      ) : (
        <label className="block text-body-sm text-on-surface">
          New account name
          <div className="mt-xs relative">
            <Icon
              name="badge"
              className="absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
            />
            <input
              name="accountName"
              required
              defaultValue={defaultNewAccountName}
              className={FIELD_INPUT_CLASS}
            />
          </div>
        </label>
      )}

      <label className="block text-body-sm text-on-surface">
        CSV file
        <div className="mt-xs relative">
          <Icon
            name="upload_file"
            className="absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
          />
          <input
            accept=".csv,text/csv"
            className="block w-full pl-[48px] pr-md py-md bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface file:mr-md file:rounded-lg file:border-0 file:bg-surface-container-high file:px-md file:py-xs file:text-label-md file:text-on-surface"
            name="csvFile"
            required
            type="file"
          />
        </div>
      </label>

      <Button variant="secondary" icon="upload" type="submit">
        Parse and import CSV
      </Button>
    </form>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={[
        "px-md py-xs rounded-md text-label-md transition-colors",
        active ? "bg-surface text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
