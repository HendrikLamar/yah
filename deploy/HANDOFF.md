# Handoff — self-hosted deploy (2026-06-10)

You (or a cold-start Claude on the server) are picking this up to **stand the
stack up on the real box**. Everything needed to deploy is already on `main`.

## Where we are

- The self-hosted production stack landed on `main` (PR #34, merge `b89297b`):
  vendored + trimmed Supabase stack, a standalone Next.js image, Caddy (auto-TLS,
  sole public service), and an in-stack cron. No supabase.com / Vercel dependency.
- All gates were green pre-merge: 90/90 units, typecheck, build, 20/20 e2e,
  156MB app image boots `/login`→200, `compose config` valid with `127.0.0.1`
  binds and no supavisor, Caddyfile valid. No secrets committed.
- Nothing has been deployed yet — no server, no `deploy/.env`, no DNS, no
  migrations applied. This machine was build/verify only.

## Do this on the server (full detail in `deploy/README.md`)

1. **DNS** — A records for `APP_DOMAIN` and `api.APP_DOMAIN` → server IP; open 80/443.
2. **Secrets** — `bash deploy/gen-secrets.sh > deploy/.env`, then edit it:
   set `APP_DOMAIN`, `CADDY_EMAIL`, the two https URLs, and `GOCARDLESS_*`.
3. **Build** — `docker compose --env-file deploy/.env -f docker-compose.prod.yml build app`
   (build off-box if the server is small; `next build` can OOM).
4. **Up** — `... up -d`, wait for `db`/`auth`/`rest`/`kong`/`studio` healthy.
5. **Migrate (deliberate, once, fresh DB)** —
   `supabase db push --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5432/postgres"`.
   This is the one step that writes live schema; run it on purpose.
6. **Smoke** — sign up at `https://APP_DOMAIN` → dashboard zero-state; verify the
   cron bearer guard 403s on a wrong secret; verify cross-user RLS isolation.

## Carry these constraints forward

- **Never commit to `main` directly** — `protect main` rejects it. Branch + PR +
  self-merge (0 approvals required).
- **Stop-and-ask before:** writing a migration, running `supabase db push` against
  a DB you didn't intend, touching `origin/main` outside a PR merge, editing
  `.env`/secrets, or touching the frozen `public/dashboard-*.{js,css,html}`.
- **No real secrets or prod domain in git** — `deploy/.env` is gitignored; keep it that way.

## Open follow-ups (deferred, not blockers)

- **Server-side Supabase URL hairpin** — `src/lib/supabase/server.ts` uses
  `NEXT_PUBLIC_SUPABASE_URL` for both browser and server, so the app process
  reaches Supabase via the public `api.APP_DOMAIN` (hairpin through Caddy). Fine
  at this scale; if the host can't hairpin-NAT, add a container hosts-entry or
  split out an internal URL. See README "Known caveat".
- SMTP / password-reset email, off-site backup shipping, and building the image
  in CI are all still deferred.
