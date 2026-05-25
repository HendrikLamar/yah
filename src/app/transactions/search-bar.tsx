"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

const OPERATORS = [
  "from:YYYY-MM-DD",
  "to:YYYY-MM-DD",
  "month:YYYY-MM",
  "year:YYYY",
  "amount>50",
  "amount<200",
  "category:slug",
  "account:name",
  "counterparty:rewe",
  'direction:expense',
  "transfer:true",
  "responsibility:shared",
  "sort:amount.desc",
];

export function SearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [showHelp, setShowHelp] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    next.delete("page");
    router.push(`?${next.toString()}`);
  }

  return (
    <form onSubmit={submit} className="space-y-xs">
      <div className="flex items-center gap-sm">
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder='rewe amount>50 category:groceries "berlin"'
          className="flex-1 px-md py-sm bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-body-md text-on-surface"
        />
        <Button type="submit" variant="secondary" icon="rule">
          Suchen
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowHelp((v) => !v)}
        >
          {showHelp ? "Hilfe schließen" : "Operatoren"}
        </Button>
      </div>
      {showHelp ? (
        <div className="rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm">
          <p className="text-body-sm text-on-surface mb-xs">
            Operatoren kombinieren freie Suche mit strukturierten Filtern:
          </p>
          <div className="flex flex-wrap gap-xs">
            {OPERATORS.map((op) => (
              <code
                key={op}
                className="text-body-sm font-mono bg-surface px-xs py-[2px] rounded border border-outline-variant"
              >
                {op}
              </code>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
