# Self-hosted yah — operator runbook

Production runs on the shared Hetzner server (`ssh igor@igor`, `167.233.85.191`)
behind the **tmh-owned Traefik**, fully containerized, deployed automatically by
GitHub Actions on every push to `main`.

- App: <https://yah.thatsmyhuman.ai> (Next.js, container `yah-app`)
- Supabase API: <https://api.yah.thatsmyhuman.ai> (Kong gateway)
- Both DNS records are DNS-only (grey cloud) A records → `167.233.85.191`.

## Architecture

```
                    Internet
                       │ 80/443
              ┌────────▼─────────┐
              │ Traefik v3        │  container thatsmyhuman-traefik-1
              │ (owned by tmh,    │  TLS via Cloudflare DNS-01
              │  /opt/tmh)        │  docker provider, labels only
              └───┬───────────┬───┘
        edge network (external, shared)
              ┌───▼───┐   ┌───▼────┐
              │ app   │   │ kong   │      ← ONLY these two join `edge`
              └───┬───┘   └───┬────┘
        ──────────┼───────────┼────────── yah private default network
              ┌───▼───────────▼──────────────────────────┐
              │ auth · rest · realtime · storage · meta   │
              │ studio · functions · imgproxy · db · cron │
              └───────────────────────────────────────────┘
```

- Traefik routing is declared as **container labels** in
  `docker-compose.prod.yml` (app) and `deploy/supabase/docker-compose.yml`
  (kong). No Traefik file-config is touched.
- Server-side app code reaches Supabase at `SUPABASE_INTERNAL_URL=http://kong:8000`
  (no hairpin through the edge); the browser uses the public api hostname.
- Postgres (5432), Kong (8000) and Studio (8001) host ports are `127.0.0.1`-bound
  — reachable only via SSH tunnel.

## Server layout (`/opt/yah`)

```
/opt/yah/
├── docker-compose.prod.yml     # rsynced by CI
├── .env                        # secrets, 0600, NEVER in git — gen-secrets.sh output
├── deploy/supabase/            # vendored Supabase stack (rsynced by CI, no --delete:
│   └── volumes/db/data         #   the live Postgres data dir lives inside it!)
├── supabase/migrations/        # rsynced by CI, applied by deploy.sh
├── scripts/                    # deploy.sh, backup.sh (rsynced by CI, --delete)
├── bin/                        # root-owned: ssh-deploy-wrapper.sh, supabase CLI
│                               #   NOT rsynced — CI can never replace these
└── backups/                    # nightly yah-*.sql.gz + pre-migrate-*.sql.gz (keep 14)
```

## CI/CD flow (`.github/workflows/deploy.yml`)

Push to `main` (or manual `workflow_dispatch`) →

1. **test** — `npm ci`, `npm run typecheck`, `npm test` (vitest).
   Playwright e2e is NOT in CI; it runs locally pre-merge.
2. **build-push** — Docker image → `ghcr.io/hendriklamar/yah:<sha>`
   (build args bake the public URLs + anon key into the browser bundle).
3. **deploy** — rsync compose/scripts/migrations to `/opt/yah`, then
   `ssh igor@… "IMAGE_TAG=<sha> /opt/yah/scripts/deploy.sh"`.

`deploy.sh` then: validates the tag → `compose pull` → starts db → takes a
pre-migration `pg_dump` snapshot → `supabase db push` (applies pending
migrations) → `compose up -d --remove-orphans` → health gate
(`/login` must return 200, `/api/cron/sync` must reject a wrong bearer) →
prunes dangling images. Any failure exits non-zero and fails the Actions run.

The SSH deploy key (GitHub secret `DEPLOY_SSH_KEY`) is pinned in
`~igor/.ssh/authorized_keys` to the forced command
`/opt/yah/bin/ssh-deploy-wrapper.sh`, which permits **only** rsync with all
paths under `/opt/yah/` and exactly `IMAGE_TAG=<hex> /opt/yah/scripts/deploy.sh`.
Rejected commands land in `/opt/yah/deploy.log`.

GitHub repo config: secrets `DEPLOY_SSH_KEY`, `SUPABASE_ANON_KEY`.

## One-time server setup (already done — for rebuild reference)

```bash
# 1. Shared edge network (Traefik attaches to it via tmh's compose)
docker network create edge

# 2. Layout (incl. rsync target parents — first CI run can't mkdir them)
sudo mkdir -p /opt/yah/{scripts,bin,backups,secrets,supabase/migrations,deploy/supabase}
sudo chown -R igor:igor /opt/yah && chmod 700 /opt/yah/backups

# 3. Secrets (ON THE SERVER; fill ENABLE_BANKING_* afterwards)
bash gen-secrets.sh > /opt/yah/.env && chmod 600 /opt/yah/.env

# 4. Deploy key: ssh-keygen -t ed25519 -C yah-deploy; append the pub key to
#    ~igor/.ssh/authorized_keys with
#    command="/opt/yah/bin/ssh-deploy-wrapper.sh",no-pty,no-agent-forwarding,no-X11-forwarding,no-port-forwarding
#    private key -> GitHub secret DEPLOY_SSH_KEY, then delete local copies.

# 5. Wrapper + supabase CLI into root-owned bin/. Extract the WHOLE tarball:
#    it ships `supabase` (shim) + `supabase-go`, and the shim needs its sibling.
sudo cp ssh-deploy-wrapper.sh /opt/yah/bin/ && sudo chown -R root:root /opt/yah/bin
curl -fsSL https://github.com/supabase/cli/releases/download/v2.109.0/supabase_2.109.0_linux_amd64.tar.gz \
  | sudo tar -xz -C /opt/yah/bin
sudo chmod 755 /opt/yah/bin/*

# 6. Nightly backup (03:00, offset from tmh's 02:00)
crontab -l | { cat; echo '0 3 * * * bash /opt/yah/scripts/backup.sh >> /opt/yah/backups/backup.log 2>&1'; } | crontab -
```

Plus: tmh's `docker-compose.prod.yml` attaches its `traefik` service to the
external `edge` network (one-line PR in the `thatsmyhuman` repo).

## Operations

```bash
# Logs
ssh igor@igor 'docker logs -n 100 -f yah-app'

# Studio (admin UI) — SSH tunnel only
ssh -L 8001:127.0.0.1:8001 igor@igor   # → http://localhost:8001 (basic-auth in .env)

# psql
ssh igor@igor -t 'docker exec -it supabase-db psql -U postgres'

# Manual deploy of a specific sha (normally CI's job)
ssh igor@igor 'IMAGE_TAG=<sha> bash /opt/yah/scripts/deploy.sh'

# Manual backup now
ssh igor@igor 'bash /opt/yah/scripts/backup.sh'

# Restore into the DB (DANGER — stop the app first)
ssh igor@igor
  cd /opt/yah && docker compose -f docker-compose.prod.yml --env-file .env stop app cron
  gunzip -c backups/<file>.sql.gz | docker exec -i supabase-db psql -U postgres -d postgres
  docker compose -f docker-compose.prod.yml --env-file .env up -d
```

## Troubleshooting

- **Actions deploy job fails at the health gate** — `docker logs yah-app` on the
  server; check which tag is live with `grep IMAGE_TAG /opt/yah/.env`.
- **Rollback** — run the manual deploy line above with the previous sha
  (GHCR keeps every sha; local images survive until pruned).
- **522/timeout via Cloudflare** — records must be DNS-only (grey cloud);
  proxying breaks the direct-origin assumption.
- **Migration failed mid-deploy** — restore point is
  `backups/pre-migrate-<ts>.sql.gz`; the app was not restarted (deploy.sh
  migrates before `up`).
- **Wrapper rejects CI** — `/opt/yah/deploy.log` records the exact rejected
  command string.
