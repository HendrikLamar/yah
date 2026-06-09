# Self-hosted yah — operator runbook

Runs the whole backend (Postgres + Auth + REST + Realtime + Storage + Studio +
Kong) plus the Next.js app, an in-stack cron, and a Caddy reverse proxy with
automatic HTTPS — on **one server**, with `docker compose`. No dependency on
supabase.com or Vercel. Greenfield: the existing migrations build the schema and
users re-register (no data is migrated).

## Layout

```
docker-compose.prod.yml      # root orchestration (includes the stack below)
deploy/
  supabase/docker-compose.yml  # vendored Supabase stack (trimmed) + volumes/
  Caddyfile                    # app -> :3000, api -> kong:8000, auto-TLS
  gen-secrets.sh / mint-jwt.mjs# secret generation + JWT minting
  cron/crontab                 # 6-hourly bank sync (replaces Vercel Cron)
  .env.example                 # env template (real deploy/.env is gitignored)
```

The Supabase stack is vendored from `supabase/supabase` `docker/` at commit
`2d422e4d9dcd684eaad517f7b4b77b15aebc384b`. Local edits (isolated, see the file
header): removed the `supavisor` pooler; bound `db`/`kong`/`studio` host ports to
`127.0.0.1`; dropped Kong's 8443 publish; removed the public Studio route in
`volumes/api/kong.yml`.

## Prerequisites

- A server with Docker + Docker Compose v2, ports **80/443** open to the internet.
- Two DNS **A records** pointing at the server:
  - `APP_DOMAIN`            (e.g. `yah.example.com`)
  - `api.APP_DOMAIN`        (e.g. `api.yah.example.com`)
- The Supabase CLI (`supabase`) available where you run the migration step.

## 1. Configure secrets

```bash
bash deploy/gen-secrets.sh > deploy/.env
# Edit deploy/.env: set APP_DOMAIN, CADDY_EMAIL, the https URLs, and GOCARDLESS_*.
```

`gen-secrets.sh` creates a strong `JWT_SECRET` and mints `ANON_KEY` /
`SERVICE_ROLE_KEY` as HS256 JWTs signed by it, plus the DB password, dashboard
password, `SECRET_KEY_BASE`, `PG_META_CRYPTO_KEY`, `CRON_SECRET`, and
`TOKEN_ENCRYPTION_KEY`.

## 2. Build the app image

NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so they
are passed as build args (sourced from `deploy/.env`). Building **off the prod
box** is recommended (avoids OOM during `next build`):

```bash
docker compose --env-file deploy/.env -f docker-compose.prod.yml build app
# (or build + push to a registry, then `docker compose ... pull app` on-server)
```

## 3. Bring up the stack

```bash
docker compose --env-file deploy/.env -f docker-compose.prod.yml up -d
docker compose --env-file deploy/.env -f docker-compose.prod.yml ps
```

Caddy obtains certificates for both hostnames on first boot (DNS must resolve
first). Wait for `db`, `auth`, `rest`, `kong`, `studio` to report healthy.

## 4. Apply migrations (once, on a fresh DB)

Postgres is bound to `127.0.0.1:5432`. From the server:

```bash
supabase db push \
  --db-url "postgresql://postgres:$(grep -E '^POSTGRES_PASSWORD=' deploy/.env | cut -d= -f2)@127.0.0.1:5432/postgres"
```

This runs `supabase/migrations/0001_init.sql` … `0003_account_sharing.sql`,
creating all `public.*` tables, RLS policies (`auth.uid() = user_id`), and the
account-sharing SECURITY DEFINER RPCs.

## 5. Smoke test

- `https://APP_DOMAIN` → login page; sign up (autoconfirm → instant) → dashboard
  renders its zero-state.
- Cron guard:
  ```bash
  # from the server, over the internal network is automatic; to test the guard:
  docker compose --env-file deploy/.env -f docker-compose.prod.yml exec cron \
    wget -qO- --header="Authorization: Bearer WRONG" http://app:3000/api/cron/sync   # 403
  ```
- A second user cannot read the first user's `accounts` / `transactions` (RLS).

## Accessing Studio (admin)

Studio is **not** publicly routed. Tunnel to its localhost-bound port:

```bash
ssh -L 8001:127.0.0.1:8001 <server>
# then open http://localhost:8001 (basic-auth: DASHBOARD_USERNAME / DASHBOARD_PASSWORD)
```

## Backup / restore

```bash
# Backup
docker compose --env-file deploy/.env -f docker-compose.prod.yml exec db \
  pg_dump -U postgres postgres | gzip > backup-$(date +%F).sql.gz

# Restore (into a fresh DB)
gunzip -c backup-YYYY-MM-DD.sql.gz | \
  docker compose --env-file deploy/.env -f docker-compose.prod.yml exec -T db \
  psql -U postgres postgres
```

The Postgres data lives in the `deploy/supabase/volumes/db/data` bind mount
(gitignored). Snapshot or off-site that directory (stack stopped) for full DR.

## Known caveat — server-side Supabase URL

`src/lib/supabase/server.ts` uses `NEXT_PUBLIC_SUPABASE_URL` for both the browser
and the server-side clients, so the **app process** reaches Supabase via the
public `https://api.APP_DOMAIN` (a hairpin back through Caddy). This is fine for
this scale. If your host cannot hairpin-NAT its own public domain, add a hosts
entry inside the app container (or split out an internal URL) so
`api.APP_DOMAIN` resolves to the server / `kong`.

## Operating notes

- **Do not** rotate `JWT_SECRET` on a live deployment unless you intend to: it
  invalidates all sessions and requires re-minting `ANON_KEY`/`SERVICE_ROLE_KEY`.
- Dev is unaffected: keep using `supabase start` (the Supabase CLI). This stack
  is production-only.
- SMTP/password-reset email, off-site backup shipping, and building the image in
  CI are deferred — see the plan's "Out / Deferred".
