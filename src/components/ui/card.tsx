import type { ReactNode } from "react";

type Padding = "lg" | "xl";
type As = "article" | "section" | "div";

type CardProps = {
  as?: As;
  padding?: Padding;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
};

const baseClasses =
  "bg-surface-container-lowest border border-outline-variant rounded-xl";

const interactiveClasses =
  "hover:-translate-y-0.5 hover:border-primary transition-all duration-200";

const paddingClasses: Record<Padding, string> = {
  lg: "p-lg",
  xl: "p-xl",
};

export function Card({
  as = "article",
  padding = "lg",
  interactive = false,
  className = "",
  children,
}: CardProps) {
  const Tag = as;
  const classes = [
    baseClasses,
    paddingClasses[padding],
    interactive ? interactiveClasses : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <Tag className={classes}>{children}</Tag>;
}
