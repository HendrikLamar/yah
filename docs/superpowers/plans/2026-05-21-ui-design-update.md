# UI Design Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the visual layer of the `yah` Next.js app to the FinancePro design system in `DESIGN.md` (light theme, Inter, Material Symbols, sidebar shell) while keeping the brand, behaviour, routes, and data layer untouched.

**Architecture:** Tailwind v4 `@theme` tokens in `globals.css` → seven primitive components in `src/components/ui/` → new sidebar shell (`Sidebar` + `TopNav` + `MobileSidebarProvider`) → page-by-page rewrite consuming the primitives.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4 (CSS-first `@theme`), Inter via `next/font/google`, Material Symbols via CDN `<link>`, Prisma (untouched), Vitest (existing tests).

**Spec:** `docs/superpowers/specs/2026-05-21-ui-design-update-design.md` (commit `3b3e558`).

**Pre-existing repo facts the engineer should know:**
- This is Next.js 16 (App Router only) with React 19. The `AGENTS.md` warning at the repo root says: APIs may differ from training data — read `node_modules/next/dist/docs/` before guessing.
- Tailwind v4 is configured via `@import "tailwindcss"` in `src/app/globals.css`. There is no `tailwind.config.ts` file and there should not be one. All token definitions go in `@theme inline { … }` inside `globals.css`.
- `logoutAction`, `loginAction`, `registerAction` already exist in `src/app/settings/actions.ts` and are imported as server actions.
- `getCurrentViewer()` in `src/lib/auth/session.ts` returns `{ userId, email, displayName, householdId, householdName } | null`.
- `getViewerHouseholdContext()` in `src/lib/household/viewer.ts` returns the household resolution used by data-fetching pages.
- Tests live under `src/lib/**/__tests__/`. `npm test` runs Vitest.

**Commit cadence:** one commit per task. Each task ends with a `git commit`. PR opens against `main` after Task 22.

**Co-Authored-By tag:** all commits include `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` per repo convention (last 6 commits use this).

---

## Task 1: Foundation — design tokens, fonts, Material Symbols

**Files:**
- Modify: `src/app/globals.css` (full replacement)
- Modify: `src/app/layout.tsx` (full replacement)

- [ ] **Step 1: Replace `src/app/globals.css` with the token system**

The new file replaces all current content. Existing dark-mode and `--background` / `--foreground` vars are gone. Tokens map 1:1 to DESIGN.md §10. Note the radius override comment: `rounded-full` now resolves to 12px (DESIGN.md pill scale); true circles use `rounded-[9999px]` arbitrary syntax.

```css
@import "tailwindcss";

@theme inline {
  /* === Colors === */
  --color-primary: #000000;
  --color-on-primary: #ffffff;
  --color-primary-container: #131b2e;
  --color-on-primary-container: #7c839b;
  --color-primary-fixed: #dae2fd;
  --color-primary-fixed-dim: #bec6e0;
  --color-on-primary-fixed: #131b2e;
  --color-on-primary-fixed-variant: #3f465c;
  --color-inverse-primary: #bec6e0;

  --color-secondary: #006c49;
  --color-on-secondary: #ffffff;
  --color-secondary-container: #6cf8bb;
  --color-on-secondary-container: #00714d;
  --color-secondary-fixed: #6ffbbe;
  --color-secondary-fixed-dim: #4edea3;
  --color-on-secondary-fixed: #002113;
  --color-on-secondary-fixed-variant: #005236;

  --color-tertiary: #000000;
  --color-tertiary-container: #0b1c30;
  --color-on-tertiary: #ffffff;
  --color-on-tertiary-container: #75859d;
  --color-tertiary-fixed: #d3e4fe;
  --color-tertiary-fixed-dim: #b7c8e1;
  --color-on-tertiary-fixed: #0b1c30;
  --color-on-tertiary-fixed-variant: #38485d;

  --color-background: #f7f9fb;
  --color-on-background: #191c1e;
  --color-surface: #f7f9fb;
  --color-surface-bright: #f7f9fb;
  --color-surface-dim: #d8dadc;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low: #f2f4f6;
  --color-surface-container: #eceef0;
  --color-surface-container-high: #e6e8ea;
  --color-surface-container-highest: #e0e3e5;
  --color-surface-variant: #e0e3e5;
  --color-surface-tint: #565e74;
  --color-on-surface: #191c1e;
  --color-on-surface-variant: #45464d;

  --color-outline: #76777d;
  --color-outline-variant: #c6c6cd;

  --color-inverse-surface: #2d3133;
  --color-inverse-on-surface: #eff1f3;

  --color-error: #ba1a1a;
  --color-on-error: #ffffff;
  --color-error-container: #ffdad6;
  --color-on-error-container: #93000a;

  /* === Spacing === */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 48px;
  --spacing-gutter: 24px;
  --spacing-margin-mobile: 16px;
  --spacing-margin-desktop: 40px;

  /* === Radius ===
     Override defaults to DESIGN.md scale. `rounded` → 2px, `rounded-lg` → 4px,
     `rounded-xl` → 8px, `rounded-full` → 12px (for pills). For truly circular
     elements (avatar disc, decorative blurred circle in dark cards) use the
     arbitrary `rounded-[9999px]` utility. */
  --radius: 2px;
  --radius-lg: 4px;
  --radius-xl: 8px;
  --radius-full: 12px;

  /* === Typography presets ===
     `text-tabular-nums` here is a size+weight preset. For actual tabular figures
     use Tailwind's built-in `tabular-nums` utility (sets font-variant-numeric)
     in combination, e.g. class="tabular-nums text-tabular-nums font-bold". */
  --text-display-lg: 48px;
  --text-display-lg--line-height: 56px;
  --text-display-lg--letter-spacing: -0.02em;
  --text-display-lg--font-weight: 700;

  --text-headline-lg: 32px;
  --text-headline-lg--line-height: 40px;
  --text-headline-lg--letter-spacing: -0.01em;
  --text-headline-lg--font-weight: 600;

  --text-headline-lg-mobile: 28px;
  --text-headline-lg-mobile--line-height: 36px;
  --text-headline-lg-mobile--font-weight: 600;

  --text-headline-md: 24px;
  --text-headline-md--line-height: 32px;
  --text-headline-md--font-weight: 600;

  --text-headline-sm: 20px;
  --text-headline-sm--line-height: 28px;
  --text-headline-sm--font-weight: 600;

  --text-body-lg: 18px;
  --text-body-lg--line-height: 28px;
  --text-body-lg--font-weight: 400;

  --text-body-md: 16px;
  --text-body-md--line-height: 24px;
  --text-body-md--font-weight: 400;

  --text-body-sm: 14px;
  --text-body-sm--line-height: 20px;
  --text-body-sm--font-weight: 400;

  --text-label-md: 14px;
  --text-label-md--line-height: 20px;
  --text-label-md--letter-spacing: 0.05em;
  --text-label-md--font-weight: 500;

  --text-tabular-nums: 16px;
  --text-tabular-nums--line-height: 24px;
  --text-tabular-nums--font-weight: 500;

  --font-sans: var(--font-inter);
}

body {
  background: var(--color-background);
  color: var(--color-on-surface);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  vertical-align: middle;
  user-select: none;
}

.material-symbols-outlined.filled {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
```

- [ ] **Step 2: Replace `src/app/layout.tsx`**

Drops Geist, loads Inter via `next/font/google`, adds the Material Symbols `<link>` in the head, swaps body classes from `bg-background text-foreground` (which no longer exist as tokens) to `bg-background text-on-surface font-sans`.

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AppShell } from "@/components/app-shell/app-shell";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "yah · yet another haushaltsbuch",
  description: "Self-hosted household finance scaffold with DKB connection spike.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className="min-h-full bg-background text-on-surface font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify TypeScript and lint still pass**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean. The shell and pages still reference old classes (`slate-*`, `emerald-*`) — those are valid arbitrary class strings, they just won't render. Build/lint won't fail on them.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(ui): adopt DESIGN.md tokens, Inter, and Material Symbols

Replace the slate/emerald defaults with the FinancePro token scale from
DESIGN.md, swap Geist for Inter via next/font, and load Material Symbols
via CDN link. All token names match DESIGN.md §10 verbatim.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Primitive — `<Icon>`

**Files:**
- Create: `src/components/ui/icon.tsx`

- [ ] **Step 1: Create the file**

```tsx
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
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/icon.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Icon primitive

Thin wrapper around Material Symbols outlined font. Supports filled
variant for active-state icons and accessible labels.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Primitive — `<Button>`

**Files:**
- Create: `src/components/ui/button.tsx`

- [ ] **Step 1: Create the file**

Four variants (primary, secondary, ghost, pill) and two sizes (sm, md). When `as="link"` it renders as a Next `<Link>`; otherwise a `<button>`. Pill ignores the size prop and always uses `px-xl py-md` per DESIGN.md §7.

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "./icon";

type Variant = "primary" | "secondary" | "ghost" | "pill";
type Size = "sm" | "md";

type BaseProps = {
  variant: Variant;
  size?: Size;
  icon?: string;
  iconFilled?: boolean;
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
    "inline-flex items-center justify-center gap-xs text-label-md transition-all duration-150";
  const sizing = variant === "pill" ? "px-xl py-md" : sizeClasses[size];
  return [base, variantClasses[variant], sizing, className].filter(Boolean).join(" ");
}

export function Button(props: ButtonProps) {
  const { variant, size = "md", icon, iconFilled, className = "", children } = props;
  const classes = composeClasses(variant, size, className);
  const content = (
    <>
      {icon ? <Icon name={icon} filled={iconFilled} /> : null}
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
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Button primitive with four variants

primary, secondary, ghost, pill — matches DESIGN.md §7 button styles.
Renders as <Link> when as="link", otherwise <button>.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Primitive — `<Card>`

**Files:**
- Create: `src/components/ui/card.tsx`

- [ ] **Step 1: Create the file**

Two variants. The dark variant adds the decorative blurred circle per DESIGN.md §7 ("Dark Insight / CTA Card"). Children inside dark variant are wrapped in a `relative` div so they sit above the decorative circle.

```tsx
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
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Card primitive (default + dark insight variants)

Dark variant renders the decorative blurred-circle accent per DESIGN.md §7.
Interactive variant adds hover lift; default is static.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Primitive — `<Badge>`

**Files:**
- Create: `src/components/ui/badge.tsx`

- [ ] **Step 1: Create the file**

Four variants matching DESIGN.md §7 status/badge pills. Success/info use `rounded-full`; error/neutral use `rounded` (DESIGN.md is asymmetric here on purpose).

```tsx
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
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Badge primitive (success, error, info, neutral)

Matches DESIGN.md §7 status/badge pill styles. Success/info round-full;
error/neutral rounded (DESIGN.md is intentionally asymmetric).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Primitive — `<MetricCard>`

**Files:**
- Create: `src/components/ui/metric-card.tsx`

- [ ] **Step 1: Create the file**

Composes `<Card>`. `hero` switches the value to `text-display-lg` and uppercases the label. Always uses `tabular-nums` for the value (financial figures).

```tsx
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
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/metric-card.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add MetricCard primitive

Composes Card. hero uses display-lg per DESIGN.md (reserved for the single
most important metric per view); standard uses 24px tabular figures.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Primitive — `<DataTable>`

**Files:**
- Create: `src/components/ui/data-table.tsx`

- [ ] **Step 1: Create the file**

Generic table over T. Owns its own empty state (renders in place of the table when `rows.length === 0`). `tabularNums: true` on a column applies the `tabular-nums` Tailwind utility to that column's cells.

```tsx
import type { ReactNode } from "react";

type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  tabularNums?: boolean;
  render: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyState?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyState = "No entries yet.",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <p className="text-body-sm text-on-surface-variant text-center py-lg">
        {emptyState}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="bg-surface-container-low">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={[
                  "text-label-md text-on-surface-variant uppercase tracking-wider px-md py-sm",
                  column.align === "right" ? "text-right" : "text-left",
                ].join(" ")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className="hover:bg-surface-container-low transition-colors group"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={[
                    "px-md py-sm text-body-sm text-on-surface",
                    column.align === "right" ? "text-right" : "text-left",
                    column.tabularNums ? "tabular-nums" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/data-table.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add DataTable primitive

Generic table with per-column align and tabular-nums config, divide-y rows,
hover row highlight, and a self-owned empty state.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Primitive — `<PageHeader>`

**Files:**
- Create: `src/components/ui/page-header.tsx`

- [ ] **Step 1: Create the file**

Replaces the hero `<section>` of the old `<FeaturePage>`. Sits on the page background — not a Card.

```tsx
import type { ReactNode } from "react";

import { Badge } from "./badge";

type StatusVariant = "success" | "error" | "info" | "neutral";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  status?: { label: string; variant: StatusVariant };
  children?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  status,
  children,
}: PageHeaderProps) {
  return (
    <section className="mb-xl">
      <div className="flex flex-col gap-md lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-sm max-w-3xl">
          <p className="text-label-md text-secondary uppercase tracking-wider">
            {eyebrow}
          </p>
          <h1 className="text-headline-lg-mobile md:text-headline-lg text-primary">
            {title}
          </h1>
          {description ? (
            <p className="text-body-md text-on-surface-variant">{description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-md">
          {status ? <Badge variant={status.variant}>{status.label}</Badge> : null}
          {children}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/page-header.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add PageHeader primitive

Replaces the FeaturePage hero. Eyebrow + headline-lg title + optional
description and status Badge. Sits on the page background, not a Card.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Extend navigation lib (TDD — icons + page title helper)

**Files:**
- Modify: `src/lib/app-shell/__tests__/navigation.test.ts` (full replacement)
- Modify: `src/lib/app-shell/navigation.ts` (full replacement)

- [ ] **Step 1: Replace the test file with the new expectations**

Adds `icon` to every nav item, reorders so Accounts/Categories/Rules sit between Transactions and Settings per the spec, and adds tests for `getPageTitleForPath`.

```ts
import { describe, expect, it } from "vitest";

import { getPageTitleForPath, getPrimaryNavigation } from "../navigation";

describe("getPrimaryNavigation", () => {
  it("returns the core MVP navigation in the intended order with icons", () => {
    expect(getPrimaryNavigation()).toEqual([
      { href: "/", label: "Overview", icon: "insights" },
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/transactions", label: "Transactions", icon: "receipt_long" },
      { href: "/accounts", label: "Accounts", icon: "account_balance" },
      { href: "/categories", label: "Categories", icon: "label" },
      { href: "/rules", label: "Rules", icon: "rule" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ]);
  });
});

describe("getPageTitleForPath", () => {
  it.each([
    ["/", "Overview"],
    ["/dashboard", "Dashboard"],
    ["/transactions", "Transactions"],
    ["/accounts", "Accounts"],
    ["/categories", "Categories"],
    ["/rules", "Rules"],
    ["/settings", "Settings"],
  ])("maps %s to %s", (path, expected) => {
    expect(getPageTitleForPath(path)).toBe(expected);
  });

  it("returns 'yah' for an unknown path", () => {
    expect(getPageTitleForPath("/unknown")).toBe("yah");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/app-shell/__tests__/navigation.test.ts`
Expected: FAIL — current `navigation.ts` doesn't include `icon` and doesn't export `getPageTitleForPath`.

- [ ] **Step 3: Replace `src/lib/app-shell/navigation.ts` with the implementation**

```ts
export type NavigationItem = {
  href: string;
  label: string;
  icon: string;
};

const PRIMARY_NAVIGATION: NavigationItem[] = [
  { href: "/", label: "Overview", icon: "insights" },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/transactions", label: "Transactions", icon: "receipt_long" },
  { href: "/accounts", label: "Accounts", icon: "account_balance" },
  { href: "/categories", label: "Categories", icon: "label" },
  { href: "/rules", label: "Rules", icon: "rule" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function getPrimaryNavigation(): NavigationItem[] {
  return PRIMARY_NAVIGATION;
}

export function getPageTitleForPath(pathname: string): string {
  const item = PRIMARY_NAVIGATION.find((entry) => entry.href === pathname);
  return item?.label ?? "yah";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/app-shell/__tests__/navigation.test.ts`
Expected: PASS (10 tests including the parameterised cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/app-shell/navigation.ts src/lib/app-shell/__tests__/navigation.test.ts
git commit -m "$(cat <<'EOF'
feat(app-shell): add nav icons and getPageTitleForPath helper

Each navigation item now carries a Material Symbol name for the sidebar.
getPageTitleForPath powers the top-nav title in the new shell.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Mobile sidebar context

**Files:**
- Create: `src/components/app-shell/mobile-sidebar-context.tsx`

- [ ] **Step 1: Create the file**

Client-side React context exposing the mobile drawer state. The provider also renders the backdrop overlay that closes the drawer on click.

```tsx
"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

type MobileSidebarContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const MobileSidebarContext = createContext<MobileSidebarContextValue | null>(null);

export function MobileSidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );

  return (
    <MobileSidebarContext.Provider value={value}>
      {children}
      {isOpen ? (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-inverse-surface opacity-50 lg:hidden transition-opacity duration-200"
          onClick={close}
          type="button"
        />
      ) : null}
    </MobileSidebarContext.Provider>
  );
}

export function useMobileSidebar(): MobileSidebarContextValue {
  const context = useContext(MobileSidebarContext);
  if (!context) {
    throw new Error("useMobileSidebar must be used inside MobileSidebarProvider");
  }
  return context;
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/app-shell/mobile-sidebar-context.tsx
git commit -m "$(cat <<'EOF'
feat(app-shell): add MobileSidebarProvider for off-canvas drawer state

Client context shared by Sidebar (reads isOpen for translate) and TopNav
(toggles via the menu button). Provider renders the backdrop overlay.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `<Sidebar>` component

**Files:**
- Create: `src/components/app-shell/sidebar.tsx`
- Delete: `src/components/app-shell/primary-navigation.tsx` (functionality moves into Sidebar)

- [ ] **Step 1: Create `src/components/app-shell/sidebar.tsx`**

Client component — reads `usePathname()` for active state and `useMobileSidebar()` for drawer state. Imports `logoutAction` directly from the settings route's actions file (server actions are first-class imports).

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getPrimaryNavigation } from "@/lib/app-shell/navigation";

import { useMobileSidebar } from "./mobile-sidebar-context";

type SidebarProps = {
  viewer: { displayName: string; householdName: string | null } | null;
};

export function Sidebar({ viewer }: SidebarProps) {
  const pathname = usePathname();
  const { isOpen, close } = useMobileSidebar();
  const items = getPrimaryNavigation();

  const translateClass = isOpen ? "translate-x-0" : "-translate-x-full";

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 w-64 bg-surface-container-low border-r border-outline-variant z-50",
        "flex flex-col transition-transform duration-200",
        translateClass,
        "lg:translate-x-0",
      ].join(" ")}
    >
      <div className="p-lg border-b border-outline-variant">
        <div className="flex items-center gap-sm">
          <Icon name="account_balance" className="text-secondary" />
          <span className="text-headline-md text-primary">yah</span>
        </div>
        <p className="mt-xs text-label-md text-on-surface-variant uppercase tracking-wider">
          yet another haushaltsbuch
        </p>
      </div>

      <nav className="flex flex-col gap-xs py-lg flex-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const classes = [
            "flex items-center gap-md px-md py-sm text-label-md transition-colors duration-150",
            active
              ? "text-secondary font-bold border-r-4 border-secondary bg-surface-container-high"
              : "text-on-surface-variant hover:text-primary hover:bg-surface-container-high",
          ].join(" ");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={classes}
              onClick={close}
            >
              <Icon name={item.icon} filled={active} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-lg border-t border-outline-variant">
        {viewer ? (
          <form action={logoutAction}>
            <Button variant="ghost" size="sm" icon="logout" type="submit">
              Sign out
            </Button>
          </form>
        ) : (
          <Button variant="secondary" size="sm" icon="login" as="link" href="/settings">
            Sign in
          </Button>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Delete `src/components/app-shell/primary-navigation.tsx`**

Run: `git rm src/components/app-shell/primary-navigation.tsx`

The component is unused by the new Sidebar. The old `AppShell` still references it; that import is removed in Task 13.

- [ ] **Step 3: Type check (expect transient errors)**

Run: `npx tsc --noEmit`
Expected: ERRORS pointing at `src/components/app-shell/app-shell.tsx` importing the deleted file. That's fixed in Task 13. Skip the commit if you want clean intermediate state, or commit now and fix in 13. Recommended: commit now.

- [ ] **Step 4: Commit**

```bash
git add src/components/app-shell/sidebar.tsx src/components/app-shell/primary-navigation.tsx
git commit -m "$(cat <<'EOF'
feat(app-shell): add Sidebar component

256px fixed sidebar with brand block, vertical nav with active rail, and
footer sign-in/out. Mobile: off-canvas via MobileSidebarProvider, toggled
from the top-nav menu button.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: `<TopNav>` component

**Files:**
- Create: `src/components/app-shell/top-nav.tsx`

- [ ] **Step 1: Create the file**

Renders the menu button (mobile only), the page title derived from the pathname, and the viewer chip. When anonymous, the chip becomes a pill "Sign in" button.

```tsx
"use client";

import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getPageTitleForPath } from "@/lib/app-shell/navigation";

import { useMobileSidebar } from "./mobile-sidebar-context";

type TopNavProps = {
  viewer: {
    displayName: string;
    email: string;
    householdName: string | null;
  } | null;
};

export function TopNav({ viewer }: TopNavProps) {
  const pathname = usePathname();
  const { toggle } = useMobileSidebar();
  const title = getPageTitleForPath(pathname);

  return (
    <header className="fixed top-0 left-0 right-0 lg:left-64 h-16 bg-surface border-b border-outline-variant z-40 px-lg flex items-center justify-between">
      <div className="flex items-center gap-md">
        <button
          aria-label="Open menu"
          className="lg:hidden p-xs rounded-lg hover:bg-surface-container-high"
          onClick={toggle}
          type="button"
        >
          <Icon name="menu" />
        </button>
        <h1 className="text-headline-sm font-bold text-primary">{title}</h1>
      </div>

      <div className="flex items-center gap-md">
        {viewer ? (
          <div className="flex items-center gap-sm">
            <div className="w-8 h-8 rounded-[9999px] border border-outline-variant flex items-center justify-center bg-surface-container-low">
              <Icon name="account_circle" />
            </div>
            <div className="hidden sm:block">
              <div className="text-body-sm font-semibold text-on-surface">
                {viewer.displayName}
              </div>
              <div className="text-body-sm text-on-surface-variant">
                {viewer.householdName ?? "No household"}
              </div>
            </div>
          </div>
        ) : (
          <Button variant="pill" size="sm" as="link" href="/settings">
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: same transient errors from Task 11 (old AppShell still references the deleted primary-navigation). Sidebar and TopNav themselves type-check.

- [ ] **Step 3: Commit**

```bash
git add src/components/app-shell/top-nav.tsx
git commit -m "$(cat <<'EOF'
feat(app-shell): add TopNav component

Fixed 64px top nav, mobile menu toggle, page title from pathname, viewer
chip or 'Sign in' pill button on the right.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Rewrite `AppShell`

**Files:**
- Modify: `src/components/app-shell/app-shell.tsx` (full replacement)

- [ ] **Step 1: Replace the file**

Old AppShell is gone — dark slate frame, inline brand header, inline viewer chip. New AppShell just wires the Sidebar + TopNav + main, and passes the viewer down. The async fetch of `getCurrentViewer()` stays here so client components don't need to call it.

```tsx
import type { ReactNode } from "react";

import { getCurrentViewer } from "@/lib/auth/session";

import { MobileSidebarProvider } from "./mobile-sidebar-context";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const viewer = await getCurrentViewer();
  const viewerLite = viewer
    ? { displayName: viewer.displayName, householdName: viewer.householdName }
    : null;
  const viewerFull = viewer
    ? {
        displayName: viewer.displayName,
        email: viewer.email,
        householdName: viewer.householdName,
      }
    : null;

  return (
    <MobileSidebarProvider>
      <div className="min-h-screen bg-background">
        <Sidebar viewer={viewerLite} />
        <TopNav viewer={viewerFull} />
        <main className="pt-16 lg:ml-64 px-gutter">
          <div className="mx-auto max-w-[1280px] py-lg">{children}</div>
        </main>
      </div>
    </MobileSidebarProvider>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean (the dangling reference to `primary-navigation` is now gone).

- [ ] **Step 3: Smoke-test the shell in the browser**

Run: `npm run dev` and open `http://localhost:3000`.
Expected: sidebar visible on the left (256px), top nav fixed, content area to the right. Pages still render their old `<FeaturePage>`-based content inside the new shell — looks visually inconsistent (dark slate cards on light background). That's expected; Tasks 14–20 fix this page by page.

- [ ] **Step 4: Commit**

```bash
git add src/components/app-shell/app-shell.tsx
git commit -m "$(cat <<'EOF'
feat(app-shell): rewrite AppShell with sidebar + top-nav layout

Replaces the horizontal header shell with the FinancePro sidebar (w-64)
+ fixed top nav (h-16) + main content. Wraps children in
MobileSidebarProvider so the drawer state is shared.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Rewrite `/dashboard`

**Files:**
- Modify: `src/app/dashboard/page.tsx` (full replacement)

- [ ] **Step 1: Replace the file**

Hero `MetricCard` (net), paired with dark insight Card (computed shared %). Three secondary metric cards. Split + accounts row. Recent movements `DataTable`.

```tsx
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { buildHouseholdSnapshot } from "@/lib/analysis/household-snapshot";
import { prisma } from "@/lib/db/prisma";
import { getViewerHouseholdContext } from "@/lib/household/viewer";

export default async function DashboardPage() {
  const context = await getViewerHouseholdContext();
  const visibilityFilter = context.viewer
    ? {
        OR: [
          { account: { visibilityOwnerType: "SHARED" as const } },
          { account: { visibilityOwnerUserId: context.viewer.userId } },
        ],
      }
    : {};
  const accountVisibilityFilter = context.viewer
    ? {
        OR: [
          { visibilityOwnerType: "SHARED" as const },
          { visibilityOwnerUserId: context.viewer.userId },
        ],
      }
    : {};

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );

  const [accounts, monthTransactions] = await Promise.all([
    prisma.account.findMany({
      where: {
        householdId: context.householdId,
        ...accountVisibilityFilter,
      },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: context.householdId,
        bookingDate: { gte: monthStart, lte: monthEnd },
        ...visibilityFilter,
      },
      include: {
        account: true,
        category: true,
      },
      orderBy: { bookingDate: "desc" },
    }),
  ]);

  const snapshot = buildHouseholdSnapshot(
    monthTransactions.map((transaction) => ({
      bookingDate: transaction.bookingDate,
      amount: Number(transaction.amount),
      direction: transaction.direction,
      categoryName: transaction.category?.name ?? null,
      responsibilityType: transaction.responsibilityType,
      accountName: transaction.account.name,
      purposeRaw: transaction.purposeRaw,
      counterpartyName: transaction.counterpartyName,
    })),
  );

  const totalExpenses = snapshot.sharedExpenses + snapshot.personalExpenses;
  const sharedPercent =
    totalExpenses > 0 ? Math.round((snapshot.sharedExpenses / totalExpenses) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow="dashboard"
        title="Cashflow analysis and monthly snapshot"
        description={`Live data for ${context.householdName}: shared plus personal account movement analysis, seeded demo data, and whatever arrives from DKB or CSV import next.`}
        status={{
          label: context.viewer
            ? `Viewer: ${context.viewer.displayName}`
            : "Demo household active",
          variant: "success",
        }}
      />

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 md:col-span-6">
          <MetricCard hero label="Net this month" value={formatCurrency(snapshot.monthNet)} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <Card variant="dark">
            <h3 className="text-headline-sm text-on-primary-container">
              How you spend together
            </h3>
            <p className="mt-md text-body-md">
              <span className="text-display-lg text-secondary-fixed tabular-nums">
                {sharedPercent}%
              </span>
              <span className="ml-sm">of expenses were shared this month.</span>
            </p>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 md:col-span-4">
          <MetricCard label="Income this month" value={formatCurrency(snapshot.monthIncome)} />
        </div>
        <div className="col-span-12 md:col-span-4">
          <MetricCard label="Expenses this month" value={formatCurrency(snapshot.monthExpenses)} />
        </div>
        <div className="col-span-12 md:col-span-4">
          <MetricCard label="Uncategorized" value={String(snapshot.uncategorizedCount)} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 xl:col-span-7">
          <Card>
            <h3 className="text-headline-sm text-on-surface">How spending is split</h3>
            <div className="mt-md grid gap-md md:grid-cols-2">
              <SplitPanel
                title="Shared household expenses"
                value={formatCurrency(snapshot.sharedExpenses)}
                detail="Common groceries, rent, utilities, eating out and other shared costs."
              />
              <SplitPanel
                title="Personal expenses"
                value={formatCurrency(snapshot.personalExpenses)}
                detail="Private spend assigned to the signed-in user or demo personal accounts."
              />
            </div>

            <h4 className="mt-lg text-label-md text-secondary uppercase tracking-wider">
              Top expense categories this month
            </h4>
            <ul className="mt-md space-y-sm">
              {snapshot.topCategories.map((category) => (
                <li
                  key={category.name}
                  className="flex items-center justify-between bg-surface-container-low rounded-lg px-md py-sm text-body-sm"
                >
                  <span className="text-on-surface">{category.name}</span>
                  <strong className="text-on-surface tabular-nums">
                    {formatCurrency(category.amount)}
                  </strong>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-5">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Imported accounts</h3>
            <ul className="mt-md space-y-sm">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  className="bg-surface-container-low rounded-lg px-md py-sm"
                >
                  <div className="text-body-sm font-semibold text-on-surface">
                    {account.name}
                  </div>
                  <div className="text-body-sm text-on-surface-variant">
                    {account.visibilityOwnerType === "SHARED"
                      ? "Shared account"
                      : "Private account"}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card>
        <h3 className="text-headline-sm text-on-surface mb-md">Recent movements</h3>
        <DataTable
          columns={[
            {
              key: "date",
              header: "Date",
              render: (t) => t.bookingDate.toISOString().slice(0, 10),
            },
            { key: "account", header: "Account", render: (t) => t.accountName },
            {
              key: "counterparty",
              header: "Counterparty",
              render: (t) => t.counterpartyName ?? "—",
            },
            { key: "purpose", header: "Purpose", render: (t) => t.purposeRaw },
            {
              key: "category",
              header: "Category",
              render: (t) => t.categoryName ?? "Uncategorized",
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              tabularNums: true,
              render: (t) => <strong>{formatCurrency(t.amount)}</strong>,
            },
          ]}
          rows={snapshot.recentTransactions.slice(0, 10)}
          getRowKey={(t) =>
            `${t.accountName}-${t.bookingDate.toISOString()}-${t.purposeRaw}`
          }
          emptyState="No movements this month yet."
        />
      </Card>
    </>
  );
}

function SplitPanel({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-surface-container-low rounded-lg p-md">
      <p className="text-body-sm text-on-surface-variant">{title}</p>
      <p className="mt-xs text-headline-sm text-on-surface tabular-nums">{value}</p>
      <p className="mt-sm text-body-sm text-on-surface-variant">{detail}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Browser smoke test**

Run: `npm run dev` (if not already running) and visit `http://localhost:3000/dashboard`.
Verify: hero "Net this month" with large display value, dark insight card with green-tinted shared % on the right, three secondary metric cards in a row, split + accounts row, recent movements table.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): restyle with primitives and hero metric

Net-this-month becomes the display-lg hero. New dark insight card carries
the shared-vs-personal split percent. Recent movements move to the
DataTable primitive.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Rewrite `/transactions`

**Files:**
- Modify: `src/app/transactions/page.tsx` (full replacement)

- [ ] **Step 1: Replace the file**

CSV upload form and recent transactions table, restyled.

```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/db/prisma";
import { getViewerHouseholdContext } from "@/lib/household/viewer";

import { uploadCsvAction } from "./actions";

type TransactionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const context = await getViewerHouseholdContext();
  const visibilityFilter = context.viewer
    ? {
        OR: [
          { account: { visibilityOwnerType: "SHARED" as const } },
          { account: { visibilityOwnerUserId: context.viewer.userId } },
        ],
      }
    : {};
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const imported = firstValue(resolvedSearchParams.imported);
  const skipped = firstValue(resolvedSearchParams.skipped);
  const account = firstValue(resolvedSearchParams.account);
  const error = firstValue(resolvedSearchParams.error);

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId: context.householdId,
      ...visibilityFilter,
    },
    include: {
      account: true,
      category: true,
      responsibilityUser: true,
    },
    orderBy: { bookingDate: "desc" },
    take: 20,
  });

  return (
    <>
      <PageHeader
        eyebrow="transactions"
        title="Imported movements, review queue and CSV fallback"
        description="If tonight's DKB test works, the same downstream transaction model is ready. If it does not, you can already upload CSV exports here and inspect the resulting analysis path."
        status={{
          label: context.viewer
            ? `Importing for ${context.viewer.displayName}`
            : "Importing into demo household",
          variant: "success",
        }}
      />

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 lg:col-span-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Upload CSV fallback import</h3>
            <p className="mt-sm text-body-sm text-on-surface-variant">
              Supported headers include DKB-style exports like <code>Buchungstag</code>,{" "}
              <code>Wertstellung</code>, <code>Auftraggeber / Begünstigter</code>,{" "}
              <code>Verwendungszweck</code> and <code>Betrag (EUR)</code>.
            </p>

            <form action={uploadCsvAction} className="mt-md space-y-md">
              <label className="block text-body-sm text-on-surface">
                Account name for this import
                <div className="mt-xs relative">
                  <Icon
                    name="badge"
                    className="absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                  />
                  <input
                    className="w-full pl-[48px] pr-md py-md bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary-container focus:border-primary transition-all outline-none text-body-md text-on-surface"
                    defaultValue={
                      context.viewer ? `${context.viewer.displayName} CSV Import` : "CSV Import"
                    }
                    name="accountName"
                    required
                  />
                </div>
              </label>

              <label className="block text-body-sm text-on-surface">
                CSV file
                <div className="mt-xs relative">
                  <Icon
                    name="upload_file"
                    className="absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                  />
                  <input
                    accept=".csv,text/csv"
                    className="block w-full pl-[48px] pr-md py-md bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface file:mr-md file:rounded-lg file:border-0 file:bg-surface-container-high file:px-md file:py-xs file:text-label-md file:text-on-surface"
                    name="csvFile"
                    required
                    type="file"
                  />
                </div>
              </label>

              <Button variant="secondary" icon="upload" type="submit">
                Parse and import CSV
              </Button>
            </form>

            {error ? (
              <div className="mt-md">
                <Badge variant="error" icon="error">
                  {error}
                </Badge>
              </div>
            ) : null}
            {imported ? (
              <div className="mt-md">
                <Badge variant="success" icon="check_circle">
                  {`Imported ${imported} rows into ${account ?? "CSV account"}${
                    skipped ? ` · skipped duplicates: ${skipped}` : ""
                  }`}
                </Badge>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Analysis pipeline now prepared</h3>
            <ul className="mt-md space-y-sm text-body-sm text-on-surface">
              <li className="flex items-start gap-sm">
                <Icon name="check_circle" filled className="text-secondary mt-0.5" />
                <span>every imported row lands in the same Transaction model as future DKB imports</span>
              </li>
              <li className="flex items-start gap-sm">
                <Icon name="check_circle" filled className="text-secondary mt-0.5" />
                <span>rows get a deterministic import hash so duplicate CSV uploads are skipped</span>
              </li>
              <li className="flex items-start gap-sm">
                <Icon name="check_circle" filled className="text-secondary mt-0.5" />
                <span>new CSV accounts can be shared or private depending on who is signed in</span>
              </li>
              <li className="flex items-start gap-sm">
                <Icon name="check_circle" filled className="text-secondary mt-0.5" />
                <span>uncategorized movements are visible immediately in the dashboard analysis</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <Card>
        <h3 className="text-headline-sm text-on-surface mb-md">Latest imported transactions</h3>
        <DataTable
          columns={[
            {
              key: "date",
              header: "Date",
              render: (t) => t.bookingDate.toISOString().slice(0, 10),
            },
            { key: "account", header: "Account", render: (t) => t.account.name },
            {
              key: "counterparty",
              header: "Counterparty",
              render: (t) => t.counterpartyName ?? "—",
            },
            { key: "purpose", header: "Purpose", render: (t) => t.purposeRaw },
            {
              key: "category",
              header: "Category",
              render: (t) => t.category?.name ?? "Uncategorized",
            },
            {
              key: "owner",
              header: "Owner",
              render: (t) =>
                t.responsibilityType === "SHARED"
                  ? "Shared"
                  : t.responsibilityUser?.displayName ?? "Private",
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              tabularNums: true,
              render: (t) => <strong>{formatCurrency(Number(t.amount))}</strong>,
            },
          ]}
          rows={transactions}
          getRowKey={(t) => t.id}
          emptyState="No transactions imported yet — try a CSV above."
        />
      </Card>
    </>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Browser smoke test**

Run: `npm run dev` and visit `http://localhost:3000/transactions`.
Verify: upload form with leading-icon inputs, "Parse and import CSV" green secondary button, pipeline list with green check icons, recent transactions table at the bottom.

- [ ] **Step 4: Commit**

```bash
git add src/app/transactions/page.tsx
git commit -m "$(cat <<'EOF'
feat(transactions): restyle with primitives and DESIGN.md input pattern

CSV upload form gains leading Material Symbol icons and the secondary
green submit button. Status messages become Badges. Recent transactions
move to the DataTable primitive.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Rewrite `/settings`

**Files:**
- Modify: `src/app/settings/page.tsx` (full replacement)

- [ ] **Step 1: Replace the file**

Auth state card, demo access card, register form card, sign-in form card.

```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentViewer } from "@/lib/auth/session";

import { loginAction, logoutAction, registerAction } from "./actions";

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const viewer = await getCurrentViewer();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const error = firstValue(resolvedSearchParams.error);
  const auth = firstValue(resolvedSearchParams.auth);

  return (
    <>
      <PageHeader
        eyebrow="settings"
        title="Workspace, users and fallback import"
        description="User accounts now work with secure password hashes, demo data is seeded automatically, and CSV fallback import is ready if the DKB connection fails tonight."
        status={{
          label: viewer ? `Signed in as ${viewer.displayName}` : "Ready for registration or login",
          variant: viewer ? "success" : "neutral",
        }}
      />

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 lg:col-span-7">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Current access state</h3>
            <div className="mt-md space-y-sm text-body-sm text-on-surface">
              {viewer ? (
                <>
                  <p>
                    Signed in as <strong>{viewer.displayName}</strong> ({viewer.email})
                  </p>
                  <p>
                    Active household:{" "}
                    <strong>{viewer.householdName ?? "No household yet"}</strong>
                  </p>
                  <form action={logoutAction}>
                    <Button variant="ghost" size="sm" icon="logout" type="submit">
                      Sign out
                    </Button>
                  </form>
                </>
              ) : (
                <p>No user is currently signed in on this browser session.</p>
              )}
            </div>
            {error ? (
              <div className="mt-md">
                <Badge variant="error" icon="error">
                  {error}
                </Badge>
              </div>
            ) : null}
            {auth ? (
              <div className="mt-md">
                <Badge variant="success" icon="check_circle">
                  {authMessage(auth)}
                </Badge>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Demo access</h3>
            <div className="mt-md space-y-sm text-body-sm text-on-surface">
              <p>Seeded demo household with two users and sample transactions:</p>
              <ul className="space-y-xs font-mono text-[13px]">
                <li>hendrik@example.local / demo12345</li>
                <li>frau@example.local / demo12345</li>
              </ul>
              <p className="text-on-surface-variant">
                Only password hashes are stored in PostgreSQL; plain-text passwords are never
                persisted.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 lg:col-span-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Register a new household</h3>
            <form action={registerAction} className="mt-md space-y-md">
              <IconInput icon="badge" label="Display name" name="displayName" required />
              <IconInput icon="mail" label="E-mail" name="email" required type="email" />
              <IconInput
                icon="lock"
                label="Password"
                name="password"
                required
                type="password"
                minLength={8}
              />
              <IconInput icon="home" label="Household name" name="householdName" required />
              <Button variant="secondary" type="submit">
                Create account and sign in
              </Button>
            </form>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Sign in</h3>
            <form action={loginAction} className="mt-md space-y-md">
              <IconInput icon="mail" label="E-mail" name="email" required type="email" />
              <IconInput icon="lock" label="Password" name="password" required type="password" />
              <Button variant="primary" type="submit">
                Sign in
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

type IconInputProps = {
  icon: string;
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  minLength?: number;
};

function IconInput({ icon, label, name, type = "text", required, minLength }: IconInputProps) {
  return (
    <label className="block text-body-sm text-on-surface">
      {label}
      <div className="mt-xs relative">
        <Icon
          name={icon}
          className="absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
        />
        <input
          className="w-full pl-[48px] pr-md py-md bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary-container focus:border-primary transition-all outline-none text-body-md text-on-surface"
          name={name}
          type={type}
          required={required}
          minLength={minLength}
        />
      </div>
    </label>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function authMessage(auth: string): string {
  switch (auth) {
    case "registered":
      return "Account created successfully and session started.";
    case "logged-in":
      return "Signed in successfully.";
    case "logged-out":
      return "Signed out successfully.";
    default:
      return auth;
  }
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Browser smoke test**

Run: `npm run dev` and visit `http://localhost:3000/settings`.
Verify: access-state card, demo-access card, register form with four icon inputs, sign-in form with two icon inputs. Sign in as `hendrik@example.local / demo12345` and confirm the viewer chip in the top-nav updates and you're redirected to /dashboard.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "$(cat <<'EOF'
feat(settings): restyle with primitives and DESIGN.md input pattern

Auth forms gain leading Material Symbol icons. Logout becomes a ghost
button; register / sign-in are secondary / primary respectively. Status
messages become Badges.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Rewrite `/accounts`

**Files:**
- Modify: `src/app/accounts/page.tsx` (full replacement)

- [ ] **Step 1: Replace the file**

Three info cards.

```tsx
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getDkbConnectorDescriptor } from "@/lib/banking/dkb-connector";

export default function AccountsPage() {
  const descriptor = getDkbConnectorDescriptor(process.env);

  return (
    <>
      <PageHeader
        eyebrow="accounts"
        title="Connected accounts"
        description="After the live DKB test, this page will show discovered shared and personal accounts, their latest balances, and visibility ownership inside the household."
        status={{
          label: `DKB connector: ${descriptor.status}`,
          variant: descriptor.status === "ready_for_test" ? "success" : "neutral",
        }}
      />

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Ownership model</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Each account will be marked as shared, Hendrik-only, or wife-only, with visibility
              enforced from the start.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Imported details</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Display name, masked IBAN, latest balance, sync status, and last successful refresh
              timestamp.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Tonight's test outcome</h3>
            <p className="mt-md text-body-sm text-on-surface">{descriptor.summary}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/accounts/page.tsx
git commit -m "$(cat <<'EOF'
feat(accounts): restyle with PageHeader and Card primitives

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Rewrite `/categories`

**Files:**
- Modify: `src/app/categories/page.tsx` (full replacement)

- [ ] **Step 1: Replace the file**

```tsx
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        eyebrow="categories"
        title="Household categories"
        description="The MVP will start with a practical category tree for a two-person household and evolve from real transaction review. The category model is intentionally simple until live bank data is confirmed."
      />

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Initial defaults</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Salary, Other Income, Rent, Groceries, Eating Out, Mobility, Health, Insurance,
              Utilities, Shopping, Leisure, Savings, Transfer, and Uncategorized.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Later actions</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Rename, reorder, archive, and map categories to recurring DKB transaction patterns.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">MVP principle</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Keep the category list short enough to be usable every week, not theoretically
              perfect on day one.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/categories/page.tsx
git commit -m "$(cat <<'EOF'
feat(categories): restyle with PageHeader and Card primitives

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: Rewrite `/rules`

**Files:**
- Modify: `src/app/rules/page.tsx` (full replacement)

- [ ] **Step 1: Replace the file**

```tsx
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function RulesPage() {
  return (
    <>
      <PageHeader
        eyebrow="rules"
        title="Categorization rules"
        description="This page is reserved for deterministic automation rules such as REWE → Groceries or employer payment → Salary. Starting with explicit rules keeps the MVP debuggable and household-safe."
      />

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Rule types</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Contains, starts with, equals, regex, amount thresholds, and account-specific
              matching.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Rule outputs</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Set category, set shared/personal responsibility, and flag internal transfers.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Why rules first</h3>
            <p className="mt-md text-body-sm text-on-surface">
              They are predictable, explainable, and easy to override before any future
              ML-based suggestions are introduced.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/rules/page.tsx
git commit -m "$(cat <<'EOF'
feat(rules): restyle with PageHeader and Card primitives

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: Rewrite `/` (Overview)

**Files:**
- Modify: `src/app/page.tsx` (full replacement)

- [ ] **Step 1: Replace the file**

Behaviour preserved (runbook + connector capabilities). Visual only.

```tsx
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { getDkbConnectorDescriptor } from "@/lib/banking/dkb-connector";

export default function HomePage() {
  const descriptor = getDkbConnectorDescriptor(process.env);
  const statusVariant = descriptor.status === "ready_for_test" ? "success" : "neutral";

  return (
    <>
      <PageHeader
        eyebrow="overview"
        title="Project status before tonight's live DKB test"
        description="The product foundation can move forward without exposing credentials: app shell, connector abstraction, and the Python FinTS spike are in place. Tonight we only need to provide the real DKB data in .env.dkb.local and run the connection test."
        status={{ label: descriptor.summary, variant: statusVariant }}
      />

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">DKB connector spike</h3>
            <p className="mt-md text-body-sm text-on-surface">
              The live test harness is ready. It bootstraps TAN mechanisms, discovers accounts,
              fetches balances, and attempts recent transactions.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Safe fallback</h3>
            <p className="mt-md text-body-sm text-on-surface">
              If DKB FinTS proves unreliable tonight, the MVP can still continue with DKB export
              ingestion while keeping the same downstream transaction pipeline.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Next build targets</h3>
            <p className="mt-md text-body-sm text-on-surface">
              After the bank test, the next implementation wave is account persistence,
              transaction import, categories, and reporting pages.
            </p>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 lg:col-span-7">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Tonight's runbook</h3>
            <pre className="mt-md bg-surface-container-low rounded-lg p-md font-mono text-body-sm text-on-surface overflow-x-auto">
{`cd /home/pi/.hermes/hermes-agent/scratch/household-finance
cp .env.dkb.local.example .env.dkb.local
# fill in the real DKB values
npm run dkb:test`}
            </pre>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Connector capabilities</h3>
            <ul className="mt-md space-y-sm text-body-sm text-on-surface">
              <CapabilityRow
                ready={descriptor.capabilities.listsAccounts}
                label="accounts"
                trueText="ready to attempt"
                falseText="not planned"
              />
              <CapabilityRow
                ready={descriptor.capabilities.fetchesBalances}
                label="balances"
                trueText="ready to attempt"
                falseText="not planned"
              />
              <CapabilityRow
                ready={descriptor.capabilities.fetchesTransactions}
                label="transactions"
                trueText="ready to attempt"
                falseText="not planned"
              />
              <CapabilityRow
                ready={descriptor.capabilities.needsInteractiveTan}
                label="interactive TAN"
                trueText="supported in spike"
                falseText="not needed"
              />
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function CapabilityRow({
  ready,
  label,
  trueText,
  falseText,
}: {
  ready: boolean;
  label: string;
  trueText: string;
  falseText: string;
}) {
  return (
    <li className="flex items-start gap-sm">
      <Icon
        name={ready ? "check_circle" : "cancel"}
        filled={ready}
        className={ready ? "text-secondary mt-0.5" : "text-on-surface-variant mt-0.5"}
      />
      <span>
        {label}: {ready ? trueText : falseText}
      </span>
    </li>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(overview): restyle with primitives, monospaced runbook block

Behaviour preserved (DKB spike status + runbook). Runbook block sits on
the new surface-container-low chip background. Connector capabilities use
filled check_circle / cancel icons.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: Delete `FeaturePage`

**Files:**
- Delete: `src/components/app-shell/feature-page.tsx`

- [ ] **Step 1: Verify no remaining importers**

Run: `grep -rn "feature-page\|FeaturePage" src/`
Expected: zero matches (every page was rewritten to use `<PageHeader>` directly).

- [ ] **Step 2: Delete the file**

Run: `git rm src/components/app-shell/feature-page.tsx`

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor(app-shell): delete FeaturePage

Superseded by PageHeader + explicit grid sections in each page.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 22: Final verification

No new files. This task runs the verification gauntlet from the spec §Verification and produces a fix-and-recommit cycle if anything fails.

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: clean. If any new file flags unused imports or any rule violations, fix inline.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Test suite**

Run: `npm test`
Expected: all tests pass — Vitest runs `src/lib/app-shell/__tests__/navigation.test.ts` (updated in Task 9) plus all pre-existing suites under `src/lib/`.

- [ ] **Step 4: Grep guards — no legacy palette**

Run: `grep -rE "(slate|emerald|rose|amber)-[0-9]" src/`
Expected: zero matches. If any are found, replace with the appropriate DESIGN.md token equivalent (e.g. `slate-900` → `on-surface` background or `primary-container`; `emerald-400` → `secondary`).

- [ ] **Step 5: Grep guards — no raw hex in code**

Run: `grep -rE "#[0-9a-fA-F]{3,8}" src/ --include="*.tsx" --include="*.ts"`
Expected: zero matches. Raw hex is only allowed in `src/app/globals.css`. If matches appear, replace with the appropriate token class.

- [ ] **Step 6: Dev-server walkthrough**

Run: `npm run dev`
Open each route at viewport width 1280 (desktop) and 375 (mobile):
- `http://localhost:3000/`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/transactions`
- `http://localhost:3000/accounts`
- `http://localhost:3000/categories`
- `http://localhost:3000/rules`
- `http://localhost:3000/settings`

For each route verify:
- Sidebar active rail (green right border) is on the current route. The icon is filled.
- Top-nav title matches the route label.
- Viewer chip shows the signed-in user, or the "Sign in" pill when anonymous. Sign in via /settings as `hendrik@example.local / demo12345`; sign out via the sidebar footer ghost button.
- Amount columns are right-aligned and use tabular figures (digits same width).
- The dashboard's dark insight card shows the green-tinted percentage and the decorative blurred circle in the bottom-right corner.
- At 375px, the sidebar is off-canvas. Tapping the top-nav menu button opens it; tapping outside (the backdrop) closes it.

- [ ] **Step 7: Keyboard a11y smoke test**

In the running dev server, press Tab repeatedly starting from page load:
- Top-nav menu button (mobile only).
- Top-nav viewer chip / Sign in button.
- Each sidebar nav item (focus ring visible against surface-container-low).
- Sidebar footer button.
- Form inputs and submit buttons on /transactions and /settings.

Expected: visible focus indicators on every interactive element. No focus trap when the mobile drawer closes.

- [ ] **Step 8: Commit a verification marker (optional)**

If no fix-up commits were needed during this task, skip. Otherwise, commit any inline fixes you made:

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(ui): post-migration verification fixes

Fix-ups discovered during grep-guard and dev-server walkthrough at the
end of the DESIGN.md migration.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Final summary**

Print to the user:
- Total commits in this branch beyond the design spec commit.
- Confirmation that lint, typecheck, tests, and grep guards all pass.
- The list of routes verified visually.
- Any deferred work (Open Questions from the spec) that should be follow-up tickets.

---

## Self-review notes (for the author of this plan, not the executor)

**Spec coverage check:**
- ✅ Tokens (spec §Token system) → Task 1
- ✅ Inter + Material Symbols (spec §Token system) → Task 1
- ✅ All 7 primitives (spec §Primitive components) → Tasks 2–8
- ✅ Navigation icons + page-title helper (spec §App shell, §navigation map) → Task 9
- ✅ Mobile sidebar context (spec §App shell, mobile drawer state) → Task 10
- ✅ Sidebar (spec §App shell, Sidebar section) → Task 11
- ✅ TopNav (spec §App shell, Top nav section) → Task 12
- ✅ AppShell rewrite (spec §App shell, Structure) → Task 13
- ✅ All 7 page rewrites (spec §Page-by-page rewrites) → Tasks 14–20
- ✅ Delete FeaturePage (spec §Files touched) → Task 21
- ✅ Verification including grep guards (spec §Verification) → Task 22

**No placeholders:** every step contains real code or real commands. Where pages share structure (e.g. /rules and /categories), the full code appears in each task — the executor may read tasks out of order.

**Type consistency:** `MetricCard` props match between Task 6 (definition) and Task 14 (use). `Badge` variants match between Task 5 and Tasks 14/15/16. `DataTable` column shape (`{key, header, align?, tabularNums?, render}`) matches between Task 7 and Tasks 14/15. `getPrimaryNavigation` shape (with `icon`) matches between Task 9 (test + impl) and Task 11 (Sidebar). `getPageTitleForPath` matches between Task 9 and Task 12.
