import type { ReactNode } from "react";

type Variant = "default" | "dark";
type Padding = "lg" | "xl";
type As = "article" | "section" | "div";

type CardProps = {
  variant?: Variant;
  as?: As;
  padding?: Padding;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  default: "bg-surface-container-lowest border border-outline-variant rounded-xl",
  dark: "bg-primary-container text-on-primary-container rounded-xl relative overflow-hidden",
};

const interactiveClasses =
  "hover:-translate-y-0.5 hover:border-primary transition-all duration-200";

const paddingClasses: Record<Padding, string> = {
  lg: "p-lg",
  xl: "p-xl",
};

const defaultPadding: Record<Variant, Padding> = {
  default: "lg",
  dark: "xl",
};

export function Card({
  variant = "default",
  as = "article",
  padding,
  interactive = false,
  className = "",
  children,
}: CardProps) {
  const Tag = as;
  const effectivePadding = padding ?? defaultPadding[variant];
  const classes = [
    variantClasses[variant],
    paddingClasses[effectivePadding],
    interactive ? interactiveClasses : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={classes}>
      {variant === "dark" ? (
        <>
          <div
            aria-hidden
            className="absolute -right-20 -bottom-20 w-80 h-80 bg-secondary opacity-10 rounded-[9999px] blur-3xl pointer-events-none"
          />
          <div className="relative">{children}</div>
        </>
      ) : (
        children
      )}
    </Tag>
  );
}
