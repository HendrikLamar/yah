# UI Design Update — Design Spec

**Date:** 2026-05-21
**Branch:** `worktree-feat+ui-design-update`
**Status:** Design approved, pending user review of this spec.

## Summary

Migrate the app's visual layer from the current dark slate/emerald shell to the FinancePro design system defined in `DESIGN.md`. Brand identity (`yah · yet another haushaltsbuch`) and product behaviour (DKB-focused household finance) are untouched — only visuals, typography, and shell layout change. Approach: single sweep covering CSS tokens, shell (sidebar + top nav), a small primitives layer, and all seven pages.

## Goals

- Replace `slate-950/emerald-400` dark theme with the light professional FinancePro palette and Inter typography.
- Move from a horizontal-header shell to the prescribed sidebar (256px) + top nav (64px) + content layout.
- Codify DESIGN.md tokens in `globals.css` (Tailwind v4 `@theme`), then enforce them via a small primitives layer in `src/components/ui/` so future pages cannot easily drift.
- Keep all routes, all data flow, all Prisma access, and all server actions untouched.

## Non-goals

- No dark mode. DESIGN.md mentions `darkMode: "class"` but ships no complete dark palette; deferred.
- No new product features. No search, no notifications surface, no toast system, no chart components.
- No restructuring of `/` vs `/dashboard` content overlap — restyled as-is, follow-up question flagged.
- No FinancePro rebrand. The name, tagline, and German-aware copy fragments stay.

## Confirmed decisions

| Decision | Choice |
|---|---|
| Brand | Keep `yah · yet another haushaltsbuch`; DESIGN.md used for visuals only. |
| Scope | Full sweep: tokens + shell + all 7 pages in one spec. |
| Top-nav decorations | Render only functional elements: page title + viewer chip. No search, no notifications. |
| Dashboard hero metric | Net this month, rendered with `display-lg`. |
| Migration approach | Tokens → primitives → shell → pages. Primitives enforce the visual contract. |
| Tailwind | Stay on v4's CSS-first `@theme inline` syntax. No CDN script, no `tailwind.config.ts`. |
| Inter font | Loaded via `next/font/google` at weights 400, 500, 600, 700. Replaces Geist. |
| Material Symbols | Loaded via `<link rel="stylesheet">` in `layout.tsx` `<head>`. |
| Auth UX | Avatar chip shows viewer + sign-out, or "Sign in" link when anonymous. No new auth routes. |
| Data layer | Untouched. |
| Language | English UI strings (current state). German content fragments retained where domain-specific. |

---

## Token system & globals

### `src/app/globals.css` — rewritten in full

- `@import "tailwindcss";`
- `@theme inline { … }` block translating every DESIGN.md §10 token:
  - All 30+ colour tokens with `--color-*` names matching DESIGN.md exactly (e.g. `--color-primary`, `--color-secondary`, `--color-surface-container-low`, `--color-on-surface-variant`).
  - Spacing: `--spacing-xs: 4px` through `--spacing-xl: 48px`, plus `--spacing-gutter: 24px`, `--spacing-margin-mobile: 16px`, `--spacing-margin-desktop: 40px`.
  - Radius: `--radius-DEFAULT: 2px`, `--radius-lg: 4px`, `--radius-xl: 8px`, `--radius-full: 12px`. Note: `rounded-full` in Tailwind defaults to `9999px`; DESIGN.md says `rounded-full = 12px`. We override `--radius-full` to `12px` for pills/chips per DESIGN.md, and use `rounded-[9999px]` explicitly for the few truly-circular elements (avatar disc, drawer FAB if any). Documented in a CSS comment.
  - Font sizes for 10 typography tokens via Tailwind v4 compound syntax: `--text-display-lg: 48px; --text-display-lg--line-height: 56px; --text-display-lg--letter-spacing: -0.02em; --text-display-lg--font-weight: 700;` and so on for each.
  - `--font-sans: var(--font-inter)` — pulled from the next/font variable.
- Body reset block:
  ```css
  body {
    background: var(--color-background);
    color: var(--color-on-surface);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }
  ```
- Material Symbols base + filled helper:
  ```css
  .material-symbols-outlined {
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    vertical-align: middle;
    user-select: none;
  }
  .material-symbols-outlined.filled {
    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }
  ```
- The current `:root { --background: #ffffff; --foreground: #171717 }` block and the `prefers-color-scheme: dark` override are deleted.

### `src/app/layout.tsx` — updated

- Drop `Geist` / `Geist_Mono` imports.
- Import `Inter` from `next/font/google` at weights `[400, 500, 600, 700]`, expose as `--font-inter`.
- Add `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />` in the head.
- Root html: `className={\`${inter.variable} h-full antialiased\`}`.
- Body: `className="min-h-full bg-background text-on-surface font-sans"`.

### Anti-drift guarantee

No raw hex outside `globals.css`. No `slate-*` / `emerald-*` / `rose-*` / `amber-*` classes anywhere in `src/`. A grep step (Section 6 below) verifies this before claiming the migration done.

---

## App shell

Files:
- `src/components/app-shell/app-shell.tsx` — rewritten
- `src/components/app-shell/sidebar.tsx` — new
- `src/components/app-shell/top-nav.tsx` — new
- `src/components/app-shell/primary-navigation.tsx` — rewritten (vertical, icon-aware)
- `src/components/app-shell/feature-page.tsx` — **deleted**
- `src/lib/app-shell/navigation.ts` — extended with `icon: string` per nav item plus `getPageTitleForPath(pathname): string`
- `src/lib/app-shell/__tests__/navigation.test.ts` — updated for the new shape

### Structure

```tsx
<div className="min-h-screen bg-background">
  <Sidebar viewer={viewer} />                         {/* fixed inset-y-0 left-0 w-64 z-50, lg only */}
  <TopNav viewer={viewer} />                          {/* fixed top-0 left-0 right-0 h-16 lg:left-64 z-40 */}
  <main className="pt-16 lg:ml-64 px-gutter">
    <div className="mx-auto max-w-[1280px] py-lg">
      {children}
    </div>
  </main>
</div>
```

### Sidebar

- Container: `aside fixed inset-y-0 left-0 w-64 bg-surface-container-low border-r border-outline-variant z-50 flex flex-col`. On `< lg`, off-canvas: `-translate-x-full lg:translate-x-0 transition-transform duration-200`. When the mobile drawer is open, the container gets `translate-x-0` regardless of breakpoint.
- Mobile drawer state lives in a `MobileSidebarContext` (client). `src/components/app-shell/mobile-sidebar-context.tsx` exports a provider with `{ isOpen, open, close, toggle }`. The provider is rendered just inside `AppShell` (as a client wrapper) so both `Sidebar` and `TopNav` can read/write it. The menu button in `TopNav` calls `toggle`. A backdrop element rendered by the provider closes the drawer on click.
- Brand block (`p-lg border-b border-outline-variant`):
  - Row: `<Icon name="account_balance" />` + `<span class="headline-md font-semibold">yah</span>`
  - Subtitle: `<p class="label-md text-on-surface-variant uppercase tracking-wider mt-xs">yet another haushaltsbuch</p>`
- Primary nav (`flex flex-col gap-xs py-lg flex-1`). No horizontal padding on the container — items extend edge-to-edge so the active right rail (`border-r-4 border-secondary`) sits flush with the sidebar's right edge:
  - Each item: `<Link>` containing `<Icon />` + label.
  - Inactive: `flex items-center gap-md px-md py-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors duration-150`.
  - Active: same + `text-secondary font-bold border-r-4 border-secondary bg-surface-container-high`. Icon switches to `filled` variant when active.
  - Items are not rounded — the active background extends edge-to-edge.
- Footer block (`mt-auto p-lg border-t border-outline-variant`):
  - When viewer present: `<form action={logoutAction}>` containing `<Button variant="ghost" size="sm" icon="logout">Sign out</Button>`.
  - When anonymous: `<Button variant="secondary" size="sm" icon="login" as={Link} href="/settings">Sign in</Button>`.

### Top nav

- Container: `header fixed top-0 left-0 right-0 lg:left-64 h-16 bg-surface border-b border-outline-variant z-40 px-lg flex items-center justify-between`.
- Left:
  - On `< lg`: a `<button>` with `<Icon name="menu" />` that toggles sidebar.
  - Page title via `getPageTitleForPath(usePathname())` in `headline-sm font-bold`.
- Right (viewer chip):
  - When viewer: `<Icon name="account_circle" />` (in a `w-8 h-8 rounded-[9999px] border border-outline-variant flex items-center justify-center bg-surface-container-low`) + two-line text block (display name in `body-sm font-semibold`, household name in `body-sm text-on-surface-variant`).
  - When anonymous: `<Button variant="pill" size="sm" as={Link} href="/settings">Sign in</Button>`.

### Navigation map

| Route | Label | Material Symbol |
|---|---|---|
| `/` | Overview | `insights` |
| `/dashboard` | Dashboard | `dashboard` |
| `/transactions` | Transactions | `receipt_long` |
| `/accounts` | Accounts | `account_balance` |
| `/categories` | Categories | `label` |
| `/rules` | Rules | `rule` |
| `/settings` | Settings | `settings` |

---

## Primitive components

New folder: `src/components/ui/`. Seven primitives. Pages compose them; raw token classes outside primitives are a smell that should be caught in code review.

### `<Icon>`
- Props: `{ name: string; filled?: boolean; className?: string; ariaLabel?: string }`
- Renders `<span class="material-symbols-outlined">{name}</span>` (or `+ filled` class).
- Aria-hidden by default; if `ariaLabel` provided, sets `role="img" aria-label`.

### `<Button>`
- Props: `{ variant: 'primary' | 'secondary' | 'ghost' | 'pill'; size?: 'sm' | 'md'; icon?: string; iconFilled?: boolean; as?: 'button' | 'link'; href?: string; type?: 'button' | 'submit'; disabled?: boolean; children: ReactNode; className?: string }`
- Variant styles (using DESIGN.md §7 verbatim, parametrised by size):
  - `primary`: `bg-primary text-on-primary rounded-lg hover:opacity-90 active:scale-[0.98]` + size padding.
  - `secondary`: `bg-secondary text-on-secondary rounded-lg shadow-sm hover:opacity-90 active:scale-[0.98]`.
  - `ghost`: `border border-outline-variant text-on-surface rounded-lg hover:bg-surface-container-high`.
  - `pill`: `bg-secondary text-on-secondary rounded-full font-bold hover:scale-105`.
- Size padding: `sm` = `px-md py-xs`, `md` = `px-md py-sm`. Pill always `px-xl py-md`.
- Font: `label-md` for all variants. Icon prefix when `icon` provided, gap `gap-xs`.
- When `as="link"`, renders as Next `Link` instead of `button`.

### `<Card>`
- Props: `{ variant?: 'default' | 'dark'; as?: 'article' | 'section' | 'div'; padding?: 'lg' | 'xl'; interactive?: boolean; className?: string; children: ReactNode }`
- `default`: `bg-surface-container-lowest border border-outline-variant rounded-xl p-lg`. With `interactive`: + `hover:-translate-y-0.5 hover:border-primary transition-all duration-200`.
- `dark`: `bg-primary-container text-on-primary-container rounded-xl p-xl relative overflow-hidden`. Also renders a decorative `<div class="absolute -right-20 -bottom-20 w-80 h-80 bg-secondary opacity-10 rounded-[9999px] blur-3xl pointer-events-none" aria-hidden />`.
- Padding override via the `padding` prop maps `lg → p-lg`, `xl → p-xl`. Default per variant: `default → lg`, `dark → xl`.

### `<Badge>`
- Props: `{ variant: 'success' | 'error' | 'info' | 'neutral'; icon?: string; children: ReactNode; className?: string }`
- Variant styles (DESIGN.md §7):
  - `success`: `bg-secondary-container text-on-secondary-container px-sm py-xs rounded-full label-md text-[12px]`
  - `error`: `bg-error-container text-on-error-container px-sm py-xs rounded text-[12px] font-bold`
  - `info`: `bg-tertiary-fixed text-on-tertiary-fixed-variant px-sm py-xs rounded-full text-[12px] font-bold`
  - `neutral`: `bg-surface-container-high text-on-surface-variant px-sm py-xs rounded text-[12px]`
- Icon prefix when provided. Inline-flex layout with `gap-xs`.

### `<MetricCard>`
- Props: `{ label: string; value: string; hero?: boolean; helper?: string }`
- Composes `<Card>`.
- Label: `body-sm text-on-surface-variant` (uppercase + tracking when hero).
- Value: `tabular-nums font-bold text-on-surface`. Size: `text-[24px] leading-[32px]` standard, or `display-lg` when `hero`.
- Optional helper text below in `body-sm text-on-surface-variant`.

### `<DataTable>`
- Props (generic over T):
  ```ts
  type Column<T> = {
    key: string;
    header: string;
    align?: 'left' | 'right';
    render: (row: T) => ReactNode;
    tabularNums?: boolean;
  };
  type Props<T> = {
    columns: Column<T>[];
    rows: T[];
    getRowKey: (row: T) => string;
    emptyState?: string;
  };
  ```
- `<thead>`: `bg-surface-container-low`. `<th>`: `label-md text-on-surface-variant uppercase tracking-wider px-md py-sm`. Right-align headers when `align === 'right'`.
- `<tbody>`: `divide-y divide-outline-variant`. Rows: `hover:bg-surface-container-low transition-colors group`. `<td>`: `px-md py-sm`. Cells with `tabularNums: true` get `font-tabular-nums`.
- Wraps the table in `<div class="overflow-x-auto">` for narrow viewports.
- Empty state: when `rows.length === 0`, renders `<p class="body-sm text-on-surface-variant text-center py-lg">{emptyState ?? 'No entries yet.'}</p>` *in place of* the `<table>` element (the DataTable owns its own empty state; it does not rely on a parent container to render it).

### `<PageHeader>`
- Props: `{ eyebrow: string; title: string; description?: string; status?: { label: string; variant: 'success' | 'error' | 'info' | 'neutral' }; children?: ReactNode }`
- Layout: a `<section>` not a `<Card>` — page headers sit on the page background, no border.
- Eyebrow: `label-md text-secondary uppercase tracking-wider`.
- Title: `headline-lg text-primary` (or `headline-lg-mobile` below `md:`).
- Description: `body-md text-on-surface-variant max-w-3xl`.
- Status: right-aligned `<Badge>` on `lg:` and above; stacked above title on smaller widths.
- `children` slot for inline page actions (e.g. an "Export" button).

---

## Page-by-page rewrites

Data layer, server actions, and route paths are untouched throughout. Only JSX and class names change. Where the current page uses `<FeaturePage>`, the rewrite replaces it with `<PageHeader>` + explicit grid `<section>`s.

### `/` — Overview

Behaviour preserved (this page's content is scaffold-era and may want consolidation with `/dashboard` later; flagged as follow-up).

- `<PageHeader eyebrow="overview" title="Project status before tonight's live DKB test" description={…} status={{label: descriptor.summary, variant: statusTone === 'success' ? 'success' : 'neutral'}} />`
- 3-card grid (`grid-cols-12 gap-gutter`, each `col-span-12 md:col-span-4`): the three existing info cards.
- 2-col grid below (`col-span-12 lg:col-span-7` + `col-span-12 lg:col-span-5`):
  - Tonight's runbook `<Card>` with a `<pre class="bg-surface-container-low rounded-lg p-md font-mono text-sm overflow-x-auto">`.
  - Connector capabilities `<Card>` with bullet list using `<Icon name="check_circle" filled />` or `<Icon name="cancel" />` prefixes per capability.

### `/dashboard`

Highest-visibility win.

- `<PageHeader eyebrow="dashboard" title="Cashflow analysis and monthly snapshot" description={…} status={{label: viewer ? \`Viewer: ${viewer.displayName}\` : 'Demo household active', variant: 'success'}} />`
- Hero row (`grid-cols-12 gap-gutter`):
  - `<MetricCard hero label="Net this month" value={formatCurrency(snapshot.monthNet)} />` with `col-span-12 md:col-span-6`.
  - `<Card variant="dark">` insight: heading "How you spend together" in `headline-sm text-on-primary-container`, then a sentence like "Shared expenses make up **X%** of your spending this month" with the X in `text-secondary-fixed display-lg`. Computed from `snapshot.sharedExpenses` and `snapshot.sharedExpenses + snapshot.personalExpenses`. `col-span-12 md:col-span-6`.
- Secondary metrics row (`grid-cols-12 gap-gutter`): three `<MetricCard>` (income / expenses / uncategorized), each `col-span-12 md:col-span-4`.
- Split + accounts row (`grid-cols-12 gap-gutter`):
  - "How spending is split" `<Card>` (`col-span-12 xl:col-span-7`) containing two inner stat panels (shared vs personal) using a nested grid + the top-categories list as `<li>` items styled with `bg-surface-container-low rounded-lg px-md py-sm`.
  - "Imported accounts" `<Card>` (`col-span-12 xl:col-span-5`) with the existing `accounts.map` list, each item in a `bg-surface-container-low rounded-lg px-md py-sm` chip with name + visibility label.
- Recent movements `<DataTable>` inside a `<Card padding="lg">` with `<h3 class="headline-sm mb-lg">Recent movements</h3>` above the table. Columns: Date, Account, Counterparty, Purpose, Category, Amount (`align: 'right'`, `tabularNums: true`). Amount cell: `text-primary` when positive (income direction), `text-error` when negative (over-budget pattern not currently tracked, so default `text-primary` for outflows is fine — bold on all amounts).

### `/transactions`

- `<PageHeader eyebrow="transactions" title="Imported movements, review queue and CSV fallback" description={…} status={{label: viewer ? \`Importing for ${viewer.displayName}\` : 'Importing into demo household', variant: 'success'}} />`
- 2-col grid (`grid-cols-12 gap-gutter`):
  - Upload `<Card>` (`col-span-12 lg:col-span-6`) wrapping the existing `<form action={uploadCsvAction}>`. Account-name input styled per DESIGN.md §7 input pattern: `w-full pl-[48px] pr-md py-md bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary-container focus:border-primary outline-none` with a leading `<Icon name="badge" />` positioned `absolute left-md top-1/2 -translate-y-1/2`. File input styled with a custom wrapper showing `<Icon name="upload_file" />` + filename or "Choose CSV". Submit button: `<Button variant="secondary" icon="upload">Parse and import CSV</Button>`.
  - Pipeline `<Card>` (`col-span-12 lg:col-span-6`) with bullet list using `<Icon name="check_circle" filled />` prefix in `text-secondary`.
- Status messages: `<Badge variant="error">` for error, `<Badge variant="success">` for imported (rendered as full-width blocks above the form, not inline pills).
- Recent transactions `<DataTable>` inside a `<Card>` with `<h3>` above. Columns: Date, Account, Counterparty, Purpose, Category, Owner, Amount (right-aligned tabular).

### `/accounts`

- `<PageHeader eyebrow="accounts" title="Connected accounts" description={…} status={{label: \`DKB connector: ${descriptor.status}\`, variant: descriptor.status === 'ready_for_test' ? 'success' : 'neutral'}} />`
- 3-card grid (`grid-cols-12 gap-gutter`, each `col-span-12 md:col-span-4`): the three existing info cards.

### `/categories`

- `<PageHeader eyebrow="categories" title="Household categories" description={…} />`
- 3-card grid: existing three info cards.

### `/rules`

- `<PageHeader eyebrow="rules" title="Categorization rules" description={…} />`
- 3-card grid: existing three info cards.

### `/settings`

- `<PageHeader eyebrow="settings" title="Workspace, users and fallback import" description={…} status={{label: viewer ? \`Signed in as ${viewer.displayName}\` : 'Ready for registration or login', variant: viewer ? 'success' : 'neutral'}} />`
- Top 2-col grid (`grid-cols-12 gap-gutter`):
  - "Current access state" `<Card>` (`col-span-12 lg:col-span-7`) — viewer info + `<Button variant="ghost" icon="logout">Sign out</Button>` form. Error/auth status as full-width `<Badge>` blocks.
  - "Demo access" `<Card>` (`col-span-12 lg:col-span-5`) with seed credentials list.
- Bottom 2-col grid (`grid-cols-12 gap-gutter`):
  - "Register a new household" `<Card>` (`col-span-12 lg:col-span-6`) — four inputs styled per DESIGN.md input pattern (leading icons: `badge`, `mail`, `lock`, `home`), submit `<Button variant="secondary">Create account and sign in</Button>`.
  - "Sign in" `<Card>` (`col-span-12 lg:col-span-6`) — two inputs (`mail`, `lock`), submit `<Button variant="primary">Sign in</Button>`.

---

## Motion & micro-interactions

Adopted from DESIGN.md §9:
- `<Card interactive>`: `hover:-translate-y-0.5 hover:border-primary transition-all duration-200`. Default Card is static.
- All buttons: `active:scale-[0.98] transition-transform duration-150` (pill: `hover:scale-105` instead).
- Sidebar nav items: `transition-colors duration-150` (no scale — too jittery on a vertical list).
- Mobile sidebar drawer: `translate-x-0` from `-translate-x-full`, `transition-transform duration-200 ease-out`. Backdrop overlay fades `opacity-0 → opacity-50 transition-opacity duration-200`.

Not adopted:
- Page transitions.
- Chart draw-on animations (no charts in this app).
- Toast notifications (no toast surface; deferred).
- Batch button spinners (no batch actions in this app).

---

## Verification

A change is shippable only when all of these pass:

1. `npm run lint` — clean.
2. `npx tsc --noEmit` — clean.
3. `npm test` — Vitest suites pass. `src/lib/app-shell/__tests__/navigation.test.ts` updated for the new nav-item shape (label + icon + href).
4. `npm run dev` and visit every route at viewport widths 1280 and 375. Verify per-route:
   - Sidebar active rail (green right border) lights on the current route. Icon switches to filled variant.
   - Top-nav title matches the route's label.
   - Viewer chip switches between signed-in state and "Sign in" pill button correctly when logged in/out via /settings.
   - All amount columns use `tabular-nums` and right-align.
   - The dark insight card on `/dashboard` renders with the decorative blurred circle visible.
   - On `< lg` widths, sidebar is off-canvas and toggles via the top-nav `menu` button. Backdrop closes it.
   - Inputs show focus ring on tab; buttons show active scale on click.
5. Grep guards (run once before claiming the migration done):
   - `grep -rE "(slate|emerald|rose|amber)-[0-9]" src/` → zero hits.
   - `grep -rE "#[0-9a-fA-F]{3,8}" src/ --include="*.tsx" --include="*.ts"` → zero hits (raw hex only allowed in `globals.css`).
6. Keyboard a11y smoke test: tab through sidebar and the top-nav viewer chip. Verify focus rings are visible against the surface tokens. No focus trap when mobile sidebar closes.

---

## Files touched

### Created
- `src/components/ui/icon.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/metric-card.tsx`
- `src/components/ui/data-table.tsx`
- `src/components/ui/page-header.tsx`
- `src/components/app-shell/sidebar.tsx`
- `src/components/app-shell/top-nav.tsx`

### Modified
- `src/app/globals.css` — token system, body reset, Material Symbols helpers.
- `src/app/layout.tsx` — Inter font, Material Symbols `<link>`, new body classes.
- `src/components/app-shell/app-shell.tsx` — new structure (Sidebar + TopNav + main).
- `src/components/app-shell/primary-navigation.tsx` — vertical, icon-aware, active-rail.
- `src/lib/app-shell/navigation.ts` — add `icon` per item; add `getPageTitleForPath()`.
- `src/lib/app-shell/__tests__/navigation.test.ts` — assert the new shape.
- `src/app/page.tsx` — restyled with primitives.
- `src/app/dashboard/page.tsx` — restyled with primitives + hero metric + dark insight card.
- `src/app/transactions/page.tsx` — restyled with primitives + new input styling.
- `src/app/accounts/page.tsx` — restyled with primitives.
- `src/app/categories/page.tsx` — restyled with primitives.
- `src/app/rules/page.tsx` — restyled with primitives.
- `src/app/settings/page.tsx` — restyled with primitives + new input styling.

### Deleted
- `src/components/app-shell/feature-page.tsx` — superseded by `<PageHeader>` + explicit grid sections in each page.

---

## Open questions for follow-up (not in this spec)

1. `/` vs `/dashboard` content overlap. Overview today is project status + runbook; once the DKB integration is live, this content is stale. Candidates: redirect `/` → `/dashboard`; merge runbook into a docs page; delete entirely. Decide after this redesign lands.
2. Dark mode. DESIGN.md mentions `darkMode: "class"` but ships no complete dark palette. If wanted later, requires defining the dark scale and a theme toggle.
3. Toast notifications. DESIGN.md §7 specs one but the app has no toast surface yet. Add when there's a first concrete need (e.g. background sync completion).
4. Search. DESIGN.md prescribes a top-nav search input; skipped in this pass. Add when there's a concrete query target (e.g. transactions filter).
