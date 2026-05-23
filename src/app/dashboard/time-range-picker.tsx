"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

const PRESETS: Array<{ label: string; months: number }> = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
  { label: "24M", months: 24 },
];

const GRANULARITY: Array<{ label: string; value: "day" | "week" | "month" }> = [
  { label: "Tag", value: "day" },
  { label: "Woche", value: "week" },
  { label: "Monat", value: "month" },
];

export function TimeRangePicker() {
  const router = useRouter();
  const params = useSearchParams();

  const currentFrom = params.get("from");
  const currentTo = params.get("to");
  const currentGranularity = params.get("granularity") ?? "month";

  function updateRange(months: number) {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const from = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1),
    )
      .toISOString()
      .slice(0, 10);
    pushParams({ from, to });
  }

  function pushParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    router.push(`?${next.toString()}`);
  }

  function activeMonths(): number | null {
    if (!currentFrom || !currentTo) return 12;
    const from = new Date(`${currentFrom}T00:00:00.000Z`);
    const to = new Date(`${currentTo}T00:00:00.000Z`);
    const months =
      (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
      (to.getUTCMonth() - from.getUTCMonth()) +
      1;
    return PRESETS.some((p) => p.months === months) ? months : null;
  }

  const active = activeMonths();

  return (
    <div className="flex flex-wrap items-center gap-md">
      <div className="flex items-center gap-xs">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">
          Zeitraum
        </span>
        {PRESETS.map((preset) => (
          <Button
            key={preset.months}
            variant={active === preset.months ? "secondary" : "ghost"}
            size="sm"
            type="button"
            onClick={() => updateRange(preset.months)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-xs">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">
          Granularität
        </span>
        {GRANULARITY.map((g) => (
          <Button
            key={g.value}
            variant={currentGranularity === g.value ? "secondary" : "ghost"}
            size="sm"
            type="button"
            onClick={() => pushParams({ granularity: g.value })}
          >
            {g.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
