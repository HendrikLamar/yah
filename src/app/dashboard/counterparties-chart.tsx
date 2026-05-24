"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/format";
import type { CounterpartyRow } from "@/lib/analysis/timeseries";

import { buildTransactionsDrillHref } from "./drill-link";

type Props = {
  data: CounterpartyRow[];
  range: { from: Date; to: Date };
};

export function CounterpartiesChart({ data, range }: Props) {
  const router = useRouter();

  if (data.length === 0) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        Keine Ausgaben im gewählten Zeitraum.
      </p>
    );
  }

  const height = Math.max(180, data.length * 32 + 40);

  function onClickBar(point: { payload?: CounterpartyRow }) {
    const payload = point.payload;
    if (!payload) return;
    router.push(
      buildTransactionsDrillHref({
        from: range.from,
        to: range.to,
        counterparty: payload.name,
        direction: "EXPENSE",
        includeTransfers: false,
      }),
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline-variant)" />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: "var(--md-sys-color-on-surface-variant)" }}
            tickFormatter={(value: number) => formatCurrency(value)}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
            tick={{ fontSize: 12, fill: "var(--md-sys-color-on-surface-variant)" }}
          />
          <Tooltip
            formatter={(value, _name, item) => {
              const formatted = formatCurrency(
                typeof value === "number" ? value : Number(value),
              );
              const payload = item?.payload as CounterpartyRow | undefined;
              const delta = payload?.deltaPct;
              const suffix =
                delta === null || delta === undefined
                  ? "  ·  neu"
                  : `  ·  ${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% vs. Vorperiode`;
              return [`${formatted}${suffix}`, "Ausgaben"];
            }}
            contentStyle={{
              background: "var(--md-sys-color-surface)",
              border: "1px solid var(--md-sys-color-outline-variant)",
              borderRadius: 8,
            }}
          />
          <Bar
            dataKey="totalAbs"
            name="Ausgaben"
            fill="#ef4444"
            onClick={onClickBar}
            cursor="pointer"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
