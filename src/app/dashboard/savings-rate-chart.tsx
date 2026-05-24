"use client";

import {
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
import type { SavingsRatePoint } from "@/lib/analysis/timeseries";

type Props = {
  data: SavingsRatePoint[];
};

export function SavingsRateChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        Keine Monate mit Einnahmen im gewählten Zeitraum.
      </p>
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
            yAxisId="left"
            tick={{ fontSize: 12, fill: "var(--md-sys-color-on-surface-variant)" }}
            tickFormatter={(value: number) => formatCurrency(value)}
            width={80}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12, fill: "var(--md-sys-color-on-surface-variant)" }}
            tickFormatter={(value: number) => `${value.toFixed(0)}%`}
            domain={[-50, 100]}
            width={50}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === "Sparquote" || name === "Sparquote (3M Schnitt)") {
                const num = typeof value === "number" ? value : Number(value);
                return [`${num.toFixed(1)}%`, name];
              }
              return [
                formatCurrency(typeof value === "number" ? value : Number(value)),
                name,
              ];
            }}
            contentStyle={{
              background: "var(--md-sys-color-surface)",
              border: "1px solid var(--md-sys-color-outline-variant)",
              borderRadius: 8,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="net"
            name="Netto"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="savingsRate"
            name="Sparquote"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="savingsRateAvg3"
            name="Sparquote (3M Schnitt)"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
