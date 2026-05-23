# Graph Report - .  (2026-05-21)

## Corpus Check
- Corpus is ~10,313 words - fits in a single context window. You may not need a graph.

## Summary
- 349 nodes · 450 edges · 36 communities (22 shown, 14 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_App Pages & UI Shell|App Pages & UI Shell]]
- [[_COMMUNITY_Dashboard & Analytics|Dashboard & Analytics]]
- [[_COMMUNITY_Project Config & Seeds|Project Config & Seeds]]
- [[_COMMUNITY_Database & Deployment|Database & Deployment]]
- [[_COMMUNITY_Auth & Rate Limiting|Auth & Rate Limiting]]
- [[_COMMUNITY_Banking Integration API|Banking Integration API]]
- [[_COMMUNITY_TypeScript Compiler Config|TypeScript Compiler Config]]
- [[_COMMUNITY_App Layout & Navigation|App Layout & Navigation]]
- [[_COMMUNITY_CSV Parsing Pipeline|CSV Parsing Pipeline]]
- [[_COMMUNITY_Python FinTS Config|Python FinTS Config]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_DKB Connection Script|DKB Connection Script]]
- [[_COMMUNITY_Session Management|Session Management]]
- [[_COMMUNITY_Docker Deploy Info|Docker Deploy Info]]
- [[_COMMUNITY_Demo Seed Data|Demo Seed Data]]
- [[_COMMUNITY_Brand & Static Assets|Brand & Static Assets]]
- [[_COMMUNITY_Primary Navigation|Primary Navigation]]
- [[_COMMUNITY_DKB Connector Notes|DKB Connector Notes]]
- [[_COMMUNITY_Public Icons|Public Icons]]
- [[_COMMUNITY_Claude Code Settings|Claude Code Settings]]
- [[_COMMUNITY_Build Configuration|Build Configuration]]
- [[_COMMUNITY_Agent Instructions|Agent Instructions]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_File Icon|File Icon]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_Banking Test Conftest|Banking Test Conftest]]
- [[_COMMUNITY_Graphify Hook Config|Graphify Hook Config]]
- [[_COMMUNITY_Session Destruction|Session Destruction]]
- [[_COMMUNITY_Connected Account Type|Connected Account Type]]
- [[_COMMUNITY_Balance Snapshot Type|Balance Snapshot Type]]
- [[_COMMUNITY_DB Connection Info|DB Connection Info]]
- [[_COMMUNITY_Docker Stack Plan|Docker Stack Plan]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `scripts` - 13 edges
3. `getDkbConnectorDescriptor()` - 10 edges
4. `loginAction()` - 9 edges
5. `getCurrentViewer()` - 9 edges
6. `getViewerHouseholdContext()` - 9 edges
7. `FeaturePage()` - 8 edges
8. `PendingDkbConnector` - 7 edges
9. `parseTransactionCsv()` - 7 edges
10. `registerAction()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `PrismaClient globalThis singleton pattern` --semantically_similar_to--> `app service (Next.js, depends on postgres healthcheck)`  [INFERRED] [semantically similar]
  src/lib/db/prisma.ts → docker-compose.yml
- `registerAction()` --semantically_similar_to--> `hashPassword (seed.ts)`  [INFERRED] [semantically similar]
  src/app/settings/actions.ts → prisma/seed.ts
- `load_simple_env_file` --semantically_similar_to--> `Prisma Config (defineConfig)`  [INFERRED] [semantically similar]
  banking_spike/dkb_fints.py → prisma.config.ts
- `Rationale: CSV/export fallback if FinTS fails (keep same schema)` --rationale_for--> `csv.ts (parseTransactionCsv)`  [EXTRACTED]
  docs/dkb-connector-notes.md → src/lib/import/csv.ts
- `DKB fallback: CSV/export ingestion if FinTS rejected` --semantically_similar_to--> `Rationale: CSV/export fallback if FinTS fails (keep same schema)`  [INFERRED] [semantically similar]
  README.md → docs/dkb-connector-notes.md

## Hyperedges (group relationships)
- **DKB FinTS connection test pipeline: config loading, redaction, and live client execution** — dkb_fints_dkbfintsconfig, dkb_fints_load_simple_env_file, dkb_connection_test_main, dkb_connection_test_resolve_tan [EXTRACTED 0.95]
- **Prisma demo seeding flow: flag guard, user/household/category/transaction creation** — seed_demo_shouldseeddemodata, seed_main, seed_hashpassword, seed_system_categories [EXTRACTED 0.95]
- **Settings page auth flow: register, login, logout server actions with rate limiting and session management** — settings_page, settings_actions_registeraction, settings_actions_loginaction, settings_actions_logoutaction [EXTRACTED 0.95]
- **All feature pages share the FeaturePage/AppShell UI scaffold pattern** — featurepage_component, appshell_component, dashboard_page, transactions_page, accounts_page, rules_page, categories_page [INFERRED 0.95]
- **DKB configuration, connection status, and connector descriptor form the DKB integration status pipeline** — dkbconfig_parsedkbconfig, dkbconfig_getdkbconnectionstatus, dkbconnector_getdkbconnectordescriptor, connector_bankconnectordescriptor [EXTRACTED 0.95]
- **Session management and rate limiting together form the authentication security boundary** — session_getcurrentviewer, session_createsession, loginratelimit_throwifloginratelimited, loginratelimit_registerfailedloginattempt [INFERRED 0.85]
- **CSV Import Pipeline: parse → dedup hash → persist via prisma → provenance batch** — import_parsetransactioncsv, import_buildimporthash, import_importcsvtransactions, import_importbatch [EXTRACTED 0.95]
- **Docker deployment stack: compose → app service → postgres service → prisma db init** — docker_compose, docker_app_service, docker_postgres_service, db_prisma [EXTRACTED 0.92]
- **Auth guard pattern: getCurrentViewer → getViewerHouseholdContext → redirect if unauthenticated** — household_viewer, household_viewer_loginredirect, household_viewerhouseholdcontext [EXTRACTED 0.90]

## Communities (36 total, 14 thin omitted)

### Community 0 - "App Pages & UI Shell"
Cohesion: 0.07
Nodes (27): AccountsPage(), HomePage(), FeatureCard, FeaturePage(), FeaturePageProps, StatusTone, toneClasses, BalanceSnapshot (+19 more)

### Community 1 - "Dashboard & Analytics"
Cohesion: 0.11
Nodes (20): buildHouseholdSnapshot(), HouseholdSnapshot, SnapshotTransaction, sumAmounts(), getCurrentViewer(), DashboardPage(), formatCurrency(), adapter (+12 more)

### Community 2 - "Project Config & Seeds"
Cohesion: 0.06
Nodes (30): PostCSS Config, Prisma Config (defineConfig), shouldSeedDemoData, hashPassword (seed.ts), seed.ts main (Prisma demo seed entry point), SYSTEM_CATEGORIES constant, dependencies, dotenv (+22 more)

### Community 3 - "Database & Deployment"
Cohesion: 0.09
Nodes (23): prisma.ts (PrismaClient singleton), PrismaClient globalThis singleton pattern, PrismaPg adapter (@prisma/adapter-pg), app service (Next.js, depends on postgres healthcheck), postgres service (postgres:16-alpine, volume postgres_data), Rationale: CSV/export fallback if FinTS fails (keep same schema), viewer.ts (getViewerHouseholdContext), LOGIN_REQUIRED_REDIRECT constant (/settings?error=Bitte+einloggen) (+15 more)

### Community 4 - "Auth & Rate Limiting"
Cohesion: 0.15
Nodes (22): RootLayout (app/layout.tsx), HomePage (app/page.tsx), AttemptRecord, attempts, buildAttemptKey(), clearLoginRateLimit(), registerFailedLoginAttempt(), throwIfLoginRateLimited() (+14 more)

### Community 5 - "Banking Integration API"
Cohesion: 0.10
Nodes (23): AccountsPage, CategoriesPage, BankConnector, BankConnectorDescriptor, ImportedTransaction, DashboardPage, DkbConfig, DkbConnectionStatus (+15 more)

### Community 6 - "TypeScript Compiler Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 7 - "App Layout & Navigation"
Cohesion: 0.18
Nodes (9): geistMono, geistSans, metadata, AppShell(), AppShellProps, getPrimaryNavigation(), NavigationItem, PRIMARY_NAVIGATION (+1 more)

### Community 8 - "CSV Parsing Pipeline"
Cohesion: 0.18
Nodes (10): detectSeparator(), findColumnIndex(), HEADER_ALIASES, parseDate(), parseDateOrNull(), ParsedCsvTransaction, parseTransactionCsv(), splitCsvLine() (+2 more)

### Community 9 - "Python FinTS Config"
Cohesion: 0.19
Nodes (7): DkbFinTSConfig, load_simple_env_file(), _mask(), main(), _resolve_if_tan_needed(), test_load_simple_env_file_ignores_missing_file(), test_load_simple_env_file_reads_key_values()

### Community 10 - "Dev Dependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, eslint-config-next, prisma, tailwindcss, @tailwindcss/postcss, tsx, @types/node (+4 more)

### Community 11 - "DKB Connection Script"
Cohesion: 0.27
Nodes (11): banking_spike __init__, dkb_connection_test.py main, _resolve_if_tan_needed, DKB FinTS Constants (BLZ, SERVER, LOOKBACK_DAYS), DkbFinTSConfig, DkbFinTSConfig.from_env, load_simple_env_file, _mask (+3 more)

### Community 12 - "Session Management"
Cohesion: 0.22
Nodes (9): AppShell, clearLoginRateLimit, registerFailedLoginAttempt, throwIfLoginRateLimited, login-rate-limit tests, PrimaryNavigation, AuthenticatedViewer, createSession (+1 more)

### Community 13 - "Docker Deploy Info"
Cohesion: 0.32
Nodes (6): DatabaseConnectionInfo, DockerStackPlan, getDatabaseConnectionInfo(), getDockerStackPlan(), info, plan

### Community 14 - "Demo Seed Data"
Cohesion: 0.39
Nodes (5): shouldSeedDemoData(), hashPassword(), main(), prisma, SYSTEM_CATEGORIES

### Community 15 - "Brand & Static Assets"
Cohesion: 0.29
Nodes (7): Next.js Brand / Logo, Public Static Assets, Next.js Wordmark SVG (public/next.svg), UI Icon — Window / Browser Window, Vercel Brand / Platform, Vercel Logo SVG, window.svg — Browser/Application Window UI Icon

### Community 17 - "Primary Navigation"
Cohesion: 0.50
Nodes (3): navigation.ts (getPrimaryNavigation), NavigationItem type, PRIMARY_NAVIGATION constant (7-item app nav)

### Community 18 - "DKB Connector Notes"
Cohesion: 0.50
Nodes (3): DKB FinTS endpoint: https://banking-dkb.s-fints-pt-dkb.de/fints30 BLZ 12030000, Rationale: FinTS/HBCI via python-fints chosen over browser automation, DKB connector known risks (TAN/SCA, product_id, FinTS rejection)

### Community 19 - "Public Icons"
Cohesion: 0.50
Nodes (4): globe.svg — Globe/World UI Icon, Internationalization / Global Connectivity (UI concept), Next.js Starter Template Static Assets, public/ — Static Assets Directory

## Knowledge Gaps
- **144 isolated node(s):** `config`, `name`, `version`, `private`, `dev` (+139 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `registerAction()` connect `Auth & Rate Limiting` to `Project Config & Seeds`, `Demo Seed Data`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Why does `hashPassword (seed.ts)` connect `Project Config & Seeds` to `Auth & Rate Limiting`?**
  _High betweenness centrality (0.129) - this node is a cross-community bridge._
- **What connects `config`, `name`, `version` to the rest of the system?**
  _144 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Pages & UI Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.06565656565656566 - nodes in this community are weakly interconnected._
- **Should `Dashboard & Analytics` be split into smaller, more focused modules?**
  _Cohesion score 0.1051693404634581 - nodes in this community are weakly interconnected._
- **Should `Project Config & Seeds` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Database & Deployment` be split into smaller, more focused modules?**
  _Cohesion score 0.09259259259259259 - nodes in this community are weakly interconnected._