"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/format";
import type { IncomeComposition } from "@/lib/analysis/timeseries";

type Props = {
  data: IncomeComposition;
};

const BUCKET_COLOR: Record<string, string> = {
  salary: "#22c55e",
  side: "#3b82f6",
  refund: "#f59e0b",
  investment: "#7c3aed",
  other: "#a3a3a3",
};

const HISTORY_KEYS = ["salary", "side", "refund", "investment", "other"] as const;
const HISTORY_LABELS: Record<(typeof HISTORY_KEYS)[number], string> = {
  salary: "Gehalt",
  side: "Nebeneinkommen",
  refund: "Rückerstattung",
  investment: "Investitionen",
  other: "Sonstiges",
};

export function IncomeCompositionChart({ data }: Props) {
  if (data.slices.length === 0) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        Keine Einnahmen im gewählten Zeitraum.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.slices}
              dataKey="amount"
              nameKey="label"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {data.slices.map((slice) => (
                <Cell key={slice.bucket} fill={BUCKET_COLOR[slice.bucket]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                formatCurrency(typeof value === "number" ? value : Number(value))
              }
              contentStyle={{
                background: "var(--md-sys-color-surface)",
                border: "1px solid var(--md-sys-color-outline-variant)",
                borderRadius: 8,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              formatter={(value, name) => [
                formatCurrency(typeof value === "number" ? value : Number(value)),
                HISTORY_LABELS[name as (typeof HISTORY_KEYS)[number]] ?? name,
              ]}
              contentStyle={{
                background: "var(--md-sys-color-surface)",
                border: "1px solid var(--md-sys-color-outline-variant)",
                borderRadius: 8,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(name) =>
                HISTORY_LABELS[name as (typeof HISTORY_KEYS)[number]] ?? name
              }
            />
            {HISTORY_KEYS.map((key) => (
              <Bar key={key} dataKey={key} stackId="1" fill={BUCKET_COLOR[key]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
