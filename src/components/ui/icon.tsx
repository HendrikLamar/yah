import type { CSSProperties } from "react";

type IconProps = {
  name: string;
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
