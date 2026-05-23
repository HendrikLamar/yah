# DESIGN.md — FinancePro Design System

> Extracted from Google Stitch export. This file is the single source of truth for all visual decisions.
> Claude Code should reference these tokens for every component, layout, and style decision.

> **Scope: light theme only.** A dark-mode palette is not part of this design system yet. Tokens and patterns for a dark scheme will be added in a follow-up; references to "dark" backgrounds have been removed.

---

## 1. Brand Identity

- **App Name:** FinancePro
- **Tagline:** Family Account / Secure household wealth management / Fiscal Precision
- **Tone:** Professional, trustworthy, clean, data-driven
- **Icon:** `account_balance` (Material Symbols)

---

## 2. Color Tokens

All colors are defined as Tailwind CSS custom tokens. Use the token names, not raw hex values.

### Core Brand Colors
| Token | Hex | Usage |
|---|---|---|
| `primary` | `#000000` | Headlines, primary text, active borders |
| `secondary` | `#006c49` | CTAs, active nav, progress bars, highlights |
| `background` | `#f7f9fb` | Page background |
| `error` | `#ba1a1a` | Error states, warnings, negative amounts |

### Surface Hierarchy (light scale)
| Token | Hex | Usage |
|---|---|---|
| `surface-container-lowest` | `#ffffff` | Cards, modals |
| `surface` | `#f7f9fb` | Page, top nav |
| `surface-container-low` | `#f2f4f6` | Sidebar, input backgrounds |
| `surface-container` | `#eceef0` | Chips, tags |
| `surface-container-high` | `#e6e8ea` | Hover states, active rows |
| `surface-variant` | `#e0e3e5` | Dividers, subtle borders |

### On-Surface / Text Colors
| Token | Hex | Usage |
|---|---|---|
| `on-surface` | `#191c1e` | Primary body text |
| `on-surface-variant` | `#45464d` | Secondary/muted text, labels |
| `outline` | `#76777d` | Borders, icons in inactive state |
| `outline-variant` | `#c6c6cd` | Subtle dividers, card borders |

### Secondary Scale
| Token | Hex | Usage |
|---|---|---|
| `on-secondary` | `#ffffff` | Text on green buttons |
| `secondary-container` | `#6cf8bb` | Pill backgrounds, highlight chips |
| `on-secondary-container` | `#00714d` | Text on secondary-container |

### Semantic
| Token | Hex | Usage |
|---|---|---|
| `error-container` | `#ffdad6` | Error pill backgrounds |
| `on-error-container` | `#93000a` | Text on error pills |
| `on-error` | `#ffffff` | Text on error buttons |
| `tertiary-fixed` | `#d3e4fe` | Info badge background (light-on-light) |
| `on-tertiary-fixed-variant` | `#38485d` | Text on tertiary-fixed |

### Special
| Token | Hex | Usage |
|---|---|---|
| `inverse-surface` | `#2d3133` | Mobile sidebar backdrop overlay only |

---

## 3. Typography

**Font Family:** `Inter` for all text. Loaded via Google Fonts at weights 400, 500, 600, 700.

| Token | Size | Line Height | Weight | Letter Spacing | Usage |
|---|---|---|---|---|---|
| `display-lg` | 48px | 56px | 700 | -0.02em | Hero numbers (e.g. total spending) |
| `headline-lg` | 32px | 40px | 600 | -0.01em | Page titles |
| `headline-lg-mobile` | 28px | 36px | 600 | — | Page titles on mobile |
| `headline-md` | 24px | 32px | 600 | — | Section headings |
| `headline-sm` | 20px | 28px | 600 | — | Card titles, dialog headers |
| `body-lg` | 18px | 28px | 400 | — | Long-form text |
| `body-md` | 16px | 24px | 400 | — | Default body text |
| `body-sm` | 14px | 20px | 400 | — | Secondary text, timestamps |
| `label-md` | 14px | 20px | 500 | 0.05em | Buttons, tags, nav labels, table headers |
| `tabular-nums` | 16px | 24px | 500 | — | Monetary values, numeric data |

**Rules:**
- Use `tabular-nums` for all currency and numeric data to prevent layout shift
- Use `label-md` with `uppercase` and `tracking-wider` for table column headers
- `display-lg` is reserved for the single most important metric per view

---

## 4. Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `xs` | 4px | Tight gaps, icon margins |
| `sm` | 8px | Internal padding, small gaps |
| `md` | 16px | Standard padding, element gaps |
| `lg` | 24px | Card padding, section gaps |
| `xl` | 48px | Section margins, hero spacing |
| `gutter` | 24px | Grid column gap |
| `margin-mobile` | 16px | Horizontal page margin on mobile |
| `margin-desktop` | 40px | Horizontal page margin on desktop |
| `max-width` | 1280px | Max content width (`max-w-[1280px]`) |

---

## 5. Border Radius

| Token | Value | Usage |
|---|---|---|
| `DEFAULT` | 2px | Minimal rounding (table cells, small tags) |
| `lg` | 4px | Inputs, small buttons |
| `xl` | 8px | Cards, panels, modals |
| `full` | 12px | Pills, chips, avatar borders |

> Note: `rounded-full` for pill buttons (e.g. search input), `rounded-xl` for cards, `rounded-lg` for standard buttons.

---

## 6. Layout & Grid

### Shell Structure
```
├── <aside>   Sidebar — fixed, 256px wide (w-64), full height, z-50
├── <header>  Top nav — fixed, 64px tall (h-16), right of sidebar, z-40
└── <main>    Content — ml-64, pt-16 (or pt-24), px-gutter
```

### Sidebar (`w-64`, `bg-surface-container-low`)
- Brand header: `FinancePro` in `headline-md`, subtitle in `label-md text-on-surface-variant`
- Nav items: `flex items-center px-md py-sm gap-md`
- **Active nav item:** `text-secondary font-bold border-r-4 border-secondary bg-surface-container-high`
- **Inactive nav item:** `text-on-surface-variant hover:text-primary hover:bg-surface-container-high`
- CTA button at bottom: `w-full bg-secondary text-on-secondary py-sm rounded-lg font-label-md`
- Footer links (Help, Logout): `text-on-surface-variant hover:text-primary`

### Top Nav (`h-16`, `bg-surface`, `border-b border-outline-variant`)
- Left: App/page name in `headline-sm font-bold`
- Center: Search input — `bg-surface-container-low border border-outline-variant rounded-full pl-10 py-1.5`
- Right: Notifications icon + Avatar (`w-8 h-8 rounded-full border border-outline-variant`)

### Content Grid
- Use CSS Grid with `grid-cols-12 gap-gutter`
- Cards: `col-span-12`, `col-span-8`, `col-span-7`, `col-span-5`, `col-span-4` as needed
- Always `max-w-[1280px] mx-auto` inside `<main>`

---

## 7. Components

### Cards
```
bg-surface-container-lowest border border-outline-variant rounded-xl p-lg
hover:shadow-sm hover:border-primary transition-all
```

### Primary Button (brand black)
```
bg-primary text-on-primary px-md py-sm rounded-lg font-label-md
hover:opacity-90 active:scale-[0.98] transition-all
```

### Secondary Button (Green CTA)
```
bg-secondary text-on-secondary px-md py-sm rounded-lg font-label-md
hover:opacity-90 transition-opacity shadow-sm
```

### Ghost / Outline Button
```
border border-outline-variant text-on-surface px-md py-sm rounded-lg font-label-md
hover:bg-surface-container-high transition-colors
```

### Pill Button (Rounded)
```
bg-secondary text-on-secondary px-xl py-md rounded-full font-bold
hover:scale-105 transition-transform
```

### Input Fields
```
w-full pl-[48px] pr-md py-md bg-surface border border-outline-variant rounded-lg
focus:ring-2 focus:ring-primary focus:border-primary
transition-all outline-none font-body-md
```
- Always use a leading icon (Material Symbol) absolutely positioned at `left-md`

### Search Input (Pill)
```
w-full pl-14 pr-md py-md bg-white border border-outline-variant rounded-full shadow-sm
focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all outline-none
```

### Status / Badge Pills
- **Success:** `bg-secondary-container text-on-secondary-container px-sm py-xs rounded-full font-label-md text-[12px]`
- **Error / Alert:** `bg-error-container text-on-error-container px-sm py-xs rounded text-[12px] font-bold`
- **Info / Scanned:** `bg-tertiary-fixed text-on-tertiary-fixed-variant px-sm py-xs rounded-full text-[12px] font-bold`
- **Neutral:** `bg-surface-container-high text-on-surface-variant px-sm py-xs rounded text-[12px]`

### Tags / Chips (inline)
```
bg-surface-container-high text-on-surface-variant px-sm py-1 rounded font-label-md text-[12px]
```

### Tables
- `<thead>`: `bg-surface-container-low` with `font-label-md text-label-md text-on-surface-variant uppercase tracking-wider`
- `<tbody>`: `divide-y divide-outline-variant`, rows with `hover:bg-surface-container-low transition-colors group`
- Amounts: `font-tabular-nums text-tabular-nums font-bold`
- Negative amounts: `text-primary` (or `text-error` for truly negative/over-budget)

### Progress Bar
```html
<div class="w-full bg-surface-container h-2 rounded-full overflow-hidden">
  <div class="bg-secondary h-full" style="width: 78%;"></div>
</div>
```

### Insight / Hero Card (light)
```
bg-surface-container-lowest border border-outline-variant rounded-xl p-xl
```
- Use the default light card with `padding="xl"` for headline insights
- Highlight the key figure with `text-secondary` (brand green) at `text-display-lg`
- A dark variant is intentionally not provided in the current scope

### Step Stepper
- Active step: `w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-bold`
- Inactive step: `w-10 h-10 rounded-full border-2 border-outline-variant opacity-40`
- Connector line: `h-px bg-outline-variant flex-1 hidden md:block mx-md`

---

## 8. Icons

**Library:** Material Symbols Outlined  
**Load:** `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1`

```css
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  vertical-align: middle;
}
```

**Filled variant** (for active states): `style="font-variation-settings: 'FILL' 1;"`

### Icon Usage in This App
| Icon | Usage |
|---|---|
| `dashboard` | Dashboard nav |
| `account_balance` | Bank Connections nav |
| `label` | Categories nav |
| `trending_up` | Projections nav |
| `settings` | Settings nav |
| `help` / `logout` | Footer nav items |
| `notifications` | Top nav bell |
| `search` | Search inputs |
| `account_circle` | User profile fallback |
| `verified_user` | Security/trust badge (FILL 1) |
| `add` / `add_a_photo` | Add transaction |
| `file_download` | Export |
| `arrow_forward` | CTA links |
| `more_vert` | Row actions |
| `check_circle` | Status / verification (e.g. pipeline steps complete) |

---

## 9. Motion & Micro-interactions

- **Hover lift on cards:** `transform: translateY(-2px); transition: all 0.2s ease-in-out;`
- **Button press:** `active:scale-[0.98]` or `active:scale-95`
- **Icon scale on hover:** `group-hover:scale-110 transition-transform`
- **Grayscale logo reveal:** `grayscale group-hover:grayscale-0 transition-all`
- **Chart draw-on:** `stroke-dasharray/stroke-dashoffset` animation, `transition: 2s ease-out`
- **Row highlight on action:** add `bg-secondary-container/20`, remove after 1000ms
- **Batch button spinner:** swap icon to `sync animate-spin` during processing

---

## 10. Token Source of Truth

This project uses **Tailwind v4** with the CSS-first `@theme inline` block. The authoritative token definitions live in `src/app/globals.css`. Tables in this document mirror those tokens — if they ever drift, `globals.css` is canonical.

Notes on the v4 setup:

- Tokens are declared as CSS custom properties under `@theme inline { ... }` and consumed via Tailwind utility classes (e.g. `bg-surface-container-low`, `text-on-surface`, `text-display-lg`).
- Radius scale is overridden to DESIGN.md values: `--radius: 2px`, `--radius-lg: 4px`, `--radius-xl: 8px`, `--radius-full: 12px`. For genuinely circular elements (avatar disc, decorative blurred circle) use the arbitrary `rounded-[9999px]` utility — `rounded-full` is a 12 px pill in this scale.
- Typography presets are compound: `--text-X`, `--text-X--line-height`, `--text-X--letter-spacing`, `--text-X--font-weight`. Apply with a single utility like `text-headline-lg`.
- There is **no `darkMode` configuration**. Dark mode is out of scope for this iteration (see top-of-file scope note).

---

## 11. CDN Dependencies

```html
<!-- Tailwind with plugins -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<!-- Inter font -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>

<!-- Material Symbols -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
```

---

## 12. Design Principles

1. **Consistency over creativity** — always use tokens, never hardcode hex values
2. **Hierarchy through surface** — use the surface container scale to create depth without shadows
3. **Green = action, Black = structure** — secondary (green) for interactive elements, primary (black) for headings and structure
4. **Data clarity first** — `tabular-nums` for all financial figures, left-align labels, right-align amounts
5. **Restrained motion** — micro-interactions only, no page transitions, keep durations under 300ms except for chart animations
6. **Highlight key insights with the brand green** — promote the most important figure per page using `text-secondary` at `text-display-lg` inside a standard light card; do not introduce a dark surface to draw attention