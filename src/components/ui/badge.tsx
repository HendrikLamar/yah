import type { ReactNode } from "react";

import { Icon } from "./icon";

type Variant = "success" | "error" | "info" | "neutral";

type BadgeProps = {
  variant: Variant;
  icon?: string;
  className?: string;
  children: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  success:
    "bg-secondary-container text-on-secondary-container px-sm py-xs rounded-full text-[12px] font-medium tracking-wider",
  error:
    "bg-error-container text-on-error-container px-sm py-xs rounded text-[12px] font-bold",
  info:
    "bg-tertiary-fixed text-on-tertiary-fixed-variant px-sm py-xs rounded-full text-[12px] font-bold",
  neutral:
    "bg-surface-container-high text-on-surface-variant px-sm py-xs rounded text-[12px]",
};

export function Badge({ variant, icon, className = "", children }: BadgeProps) {
  const classes = ["inline-flex items-center gap-xs", variantClasses[variant], className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      {icon ? <Icon name={icon} /> : null}
      <span>{children}</span>
    </span>
  );
}
