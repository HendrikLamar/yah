"use client";

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

type Props = {
  data: CounterpartyRow[];
};

export function CounterpartiesChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        Keine Ausgaben im gewählten Zeitraum.
      </p>
    );
  }

  const height = Math.max(180, data.length * 32 + 40);

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
            formatter={(value) => formatCurrency(typeof value === "number" ? value : Number(value))}
            contentStyle={{
              background: "var(--md-sys-color-surface)",
              border: "1px solid var(--md-sys-color-outline-variant)",
              borderRadius: 8,
            }}
          />
          <Bar dataKey="totalAbs" name="Ausgaben" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
