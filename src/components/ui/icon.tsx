import type { CSSProperties } from "react";

export type IconName =
  | "account_balance"
  | "account_circle"
  | "badge"
  | "cancel"
  | "check_circle"
  | "dashboard"
  | "email"
  | "error"
  | "group"
  | "home"
  | "insights"
  | "label"
  | "lock"
  | "login"
  | "logout"
  | "mail"
  | "menu"
  | "password"
  | "receipt_long"
  | "rule"
  | "settings"
  | "upload"
  | "upload_file";

type IconProps = {
  name: IconName;
  filled?: boolean;
  className?: string;
  ariaLabel?: string;
  style?: CSSProperties;
};

export function Icon({
  name,
  filled = false,
  className = "",
  ariaLabel,
  style,
}: IconProps) {
  const classes = ["material-symbols-outlined", filled ? "filled" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      style={style}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      {name}
    </span>
  );
}
