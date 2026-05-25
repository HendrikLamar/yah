"use client";

import { useRouter, useSearchParams } from "next/navigation";

const VIEWS: Array<{ value: string; label: string }> = [
  { value: "list", label: "Liste" },
  { value: "byCounterparty", label: "Nach Empfänger" },
  { value: "byCategory", label: "Nach Kategorie" },
  { value: "byMonth", label: "Nach Monat" },
  { value: "byAccount", label: "Nach Konto" },
];

export function ViewToggle({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function pick(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "list") next.delete("view");
    else next.set("view", value);
    next.delete("page");
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="inline-flex rounded-lg border border-outline-variant bg-surface-container-low p-1">
      {VIEWS.map((v) => {
        const active = v.value === current;
        return (
          <button
            key={v.value}
            type="button"
            onClick={() => pick(v.value)}
            className={[
              "px-sm py-xs rounded-md text-label-md transition-colors",
              active
                ? "bg-surface text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface",
            ].join(" ")}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
