"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/format";
import type { CashflowPoint, Granularity } from "@/lib/analysis/timeseries";

import { buildTransactionsDrillHref } from "./drill-link";
import { periodBounds } from "./period-bounds";

type Props = {
  data: CashflowPoint[];
  granularity: Granularity;
};

export function CashflowChart({ data, granularity }: Props) {
  const router = useRouter();

  if (data.length === 0) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        Keine Transaktionen im gewählten Zeitraum.
      </p>
    );
  }

  function onClickBar(point: { payload?: CashflowPoint }) {
    const payload = point.payload;
    if (!payload) return;
    const { from, to } = periodBounds(payload.periodStart, granularity);
    router.push(
      buildTransactionsDrillHref({ from, to, includeTransfers: false }),
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline-variant)" />
          <XAxis
            dataKey="periodKey"
            tick={{ fontSize: 12, fill: "var(--md-sys-color-on-surface-variant)" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--md-sys-color-on-surface-variant)" }}
            tickFormatter={(value: number) => formatCurrency(value)}
            width={80}
          />
          <Tooltip
            formatter={(value, name, item) => {
              const formatted = formatCurrency(typeof value === "number" ? value : Number(value));
              if (item?.payload?.count !== undefined && name === "Einnahmen") {
                return [`${formatted}  ·  ${item.payload.count} Buchungen`, name];
              }
              return [formatted, name];
            }}
            labelStyle={{ color: "var(--md-sys-color-on-surface)" }}
            contentStyle={{
              background: "var(--md-sys-color-surface)",
              border: "1px solid var(--md-sys-color-outline-variant)",
              borderRadius: 8,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="income"
            name="Einnahmen"
            fill="#22c55e"
            onClick={onClickBar}
            cursor="pointer"
          />
          <Bar
            dataKey="expenses"
            name="Ausgaben"
            fill="#ef4444"
            onClick={onClickBar}
            cursor="pointer"
          />
          <Line type="monotone" dataKey="net" name="Netto" stroke="#3b82f6" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
