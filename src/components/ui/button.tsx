import Link from "next/link";
import type { ReactNode } from "react";

import { Icon, type IconName } from "./icon";

type Variant = "primary" | "secondary" | "ghost" | "pill";
type Size = "sm" | "md";

type BaseProps = {
  variant: Variant;
  size?: Size;
  icon?: IconName;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = BaseProps & {
  as?: "button";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
};

type ButtonAsLink = BaseProps & {
  as: "link";
  href: string;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary rounded-lg hover:opacity-90 active:scale-[0.98]",
  secondary:
    "bg-secondary text-on-secondary rounded-lg shadow-sm hover:opacity-90 active:scale-[0.98]",
  ghost:
    "border border-outline-variant text-on-surface rounded-lg hover:bg-surface-container-high",
  pill: "bg-secondary text-on-secondary rounded-full font-bold hover:scale-105",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-md py-xs",
  md: "px-md py-sm",
};

function composeClasses(variant: Variant, size: Size, className: string) {
  const base =
    "inline-flex items-center justify-center gap-xs text-label-md transition-all duration-150 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2";
  const sizing = variant === "pill" ? "px-xl py-md" : sizeClasses[size];
  return [base, variantClasses[variant], sizing, className].filter(Boolean).join(" ");
}

export function Button(props: ButtonProps) {
  const { variant, size = "md", icon, className = "", children } = props;
  const classes = composeClasses(variant, size, className);
  const content = (
    <>
      {icon ? <Icon name={icon} /> : null}
      <span>{children}</span>
    </>
  );

  if (props.as === "link") {
    return (
      <Link className={classes} href={props.href}>
        {content}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      type={props.type ?? "button"}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {content}
    </button>
  );
}
