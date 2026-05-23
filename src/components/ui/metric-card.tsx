import { Card } from "./card";

type MetricCardProps = {
  label: string;
  value: string;
  hero?: boolean;
  helper?: string;
};

export function MetricCard({ label, value, hero = false, helper }: MetricCardProps) {
  return (
    <Card>
      <p
        className={
          hero
            ? "text-label-md text-on-surface-variant uppercase tracking-wider"
            : "text-body-sm text-on-surface-variant"
        }
      >
        {label}
      </p>
      <p
        className={
          hero
            ? "mt-sm text-display-lg text-on-surface tabular-nums"
            : "mt-sm text-[24px] leading-[32px] font-bold text-on-surface tabular-nums"
        }
      >
        {value}
      </p>
      {helper ? (
        <p className="mt-xs text-body-sm text-on-surface-variant">{helper}</p>
      ) : null}
    </Card>
  );
}
