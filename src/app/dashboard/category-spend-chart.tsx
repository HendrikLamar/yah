"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/format";
import type { CategoryPivot } from "@/lib/analysis/timeseries";

type Props = {
  pivot: CategoryPivot;
};

const PALETTE = [
  "#7c3aed",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#3b82f6",
  "#a3a3a3",
];

export function CategorySpendChart({ pivot }: Props) {
  if (pivot.points.length === 0 || pivot.categories.length === 0) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        Keine Ausgaben mit Kategorien im gewählten Zeitraum.
      </p>
    );
  }

  const data = pivot.points.map((point) => ({
    periodKey: point.periodKey,
    ...point.totals,
  }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset="none">
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
            formatter={(value) =>
              formatCurrency(typeof value === "number" ? value : Number(value))
            }
            labelStyle={{ color: "var(--md-sys-color-on-surface)" }}
            contentStyle={{
              background: "var(--md-sys-color-surface)",
              border: "1px solid var(--md-sys-color-outline-variant)",
              borderRadius: 8,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {pivot.categories.map((category, index) => (
            <Area
              key={category}
              type="monotone"
              dataKey={category}
              stackId="1"
              stroke={PALETTE[index % PALETTE.length]}
              fill={PALETTE[index % PALETTE.length]}
              fillOpacity={0.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
