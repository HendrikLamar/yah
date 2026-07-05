#!/usr/bin/env bash
# deploy.sh — pull + migrate + up the yah production stack on igor.
# Invoked by CI through the forced-command SSH deploy key:
#   IMAGE_TAG=<sha> /opt/yah/scripts/deploy.sh
set -euo pipefail

cd /opt/yah

ENV_FILE=/opt/yah/.env
if [ ! -f "$ENV_FILE" ]; then
    echo "[deploy] ERROR: $ENV_FILE not found" >&2
    exit 1
fi

# The caller (CI) exports IMAGE_TAG before invoking; capture it before sourcing
# .env, which also defines IMAGE_TAG and would otherwise clobber the caller's.
CALLER_IMAGE_TAG="${IMAGE_TAG:-}"

# shellcheck source=/dev/null
. "$ENV_FILE"

# A caller-provided IMAGE_TAG wins and is persisted to .env so manual
# `compose up` invocations keep running the same image.
if [ -n "$CALLER_IMAGE_TAG" ]; then
    # Defense in depth: the SSH wrapper already constrains this to
    # ^[0-9a-f]{7,40}$, but re-check so a non-CI invocation can't inject sed
    # metacharacters into .env.
    if ! [[ "$CALLER_IMAGE_TAG" =~ ^[0-9a-f]{7,40}$ ]]; then
        echo "[deploy] ERROR: IMAGE_TAG '$CALLER_IMAGE_TAG' is not a valid commit sha (^[0-9a-f]{7,40}$)" >&2
        exit 1
    fi
    IMAGE_TAG="$CALLER_IMAGE_TAG"
    sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=${IMAGE_TAG}|" "$ENV_FILE"
fi
export IMAGE_TAG

if [ -z "${IMAGE_TAG:-}" ]; then
    echo "[deploy] ERROR: IMAGE_TAG is not set" >&2
    exit 1
fi
if [ -z "${APP_DOMAIN:-}" ]; then
    echo "[deploy] ERROR: APP_DOMAIN is not set in $ENV_FILE" >&2
    exit 1
fi

COMPOSE="docker compose -f /opt/yah/docker-compose.prod.yml --env-file $ENV_FILE"

echo "[deploy] Pulling images (app tag ${IMAGE_TAG}) ..."
$COMPOSE pull

# ── Database first ─────────────────────────────────────────────────────────────
# Migrations (and the pre-migration snapshot) need Postgres up; on the very
# first deploy nothing is running yet, so start db alone and wait.
echo "[deploy] Starting db ..."
$COMPOSE up -d db
for i in $(seq 1 30); do
    if docker exec supabase-db pg_isready -U postgres -h localhost >/dev/null 2>&1; then
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "[deploy] ERROR: db not ready after 150s" >&2
        $COMPOSE logs --tail=50 db >&2 || true
        exit 1
    fi
    sleep 5
done

# ── Pre-migration snapshot ─────────────────────────────────────────────────────
# Safety net for the auto-applied migrations below; nightly rotation happens in
# backup.sh, which also rotates these.
mkdir -p /opt/yah/backups
SNAP="/opt/yah/backups/pre-migrate-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
echo "[deploy] Snapshot -> $SNAP"
docker exec supabase-db pg_dump -U postgres -d postgres | gzip > "$SNAP"

# ── Migrations ─────────────────────────────────────────────────────────────────
# supabase CLI static binary, installed once by server setup (see README).
# Postgres is 127.0.0.1-bound on the host, so the binary connects directly.
# PGSSLMODE=disable: the container's Postgres has no TLS, and CLI 2.x ignores
# ?sslmode=disable in --db-url (verified against a fresh DB) but honors the
# libpq env var.
echo "[deploy] Applying migrations ..."
PGSSLMODE=disable /opt/yah/bin/supabase db push \
    --workdir /opt/yah \
    --db-url "postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/postgres" \
    --include-all --yes

echo "[deploy] Starting stack ..."
$COMPOSE up -d --remove-orphans

# ── Health gate ────────────────────────────────────────────────────────────────
echo "[deploy] Waiting for app health (https://${APP_DOMAIN}/login) ..."
RETRIES=30
INTERVAL=5
for i in $(seq 1 $RETRIES); do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://${APP_DOMAIN}/login" || true)
    if [ "$CODE" = "200" ]; then
        echo "[deploy] App healthy after $((i * INTERVAL))s"
        break
    fi
    if [ "$i" -eq "$RETRIES" ]; then
        echo "[deploy] ERROR: health check timed out after $((RETRIES * INTERVAL))s (last code: ${CODE})" >&2
        $COMPOSE logs --tail=50 app >&2 || true
        exit 1
    fi
    sleep "$INTERVAL"
done

# ── Cron-guard gate ────────────────────────────────────────────────────────────
# The sync endpoint must reject a wrong bearer (route returns 403).
CODE=$(curl -s -o /dev/null -w '%{http_code}' \
    -H 'Authorization: Bearer wrong-secret' \
    "https://${APP_DOMAIN}/api/cron/sync" || true)
if [ "$CODE" != "401" ] && [ "$CODE" != "403" ]; then
    echo "[deploy] ERROR: cron guard gate FAILED — expected 401/403, got ${CODE}" >&2
    exit 1
fi
echo "[deploy] Cron guard gate PASSED (${CODE})"

# ── Cleanup ────────────────────────────────────────────────────────────────────
# Prune dangling images only — never -a (would delete rollback targets).
docker image prune -f

echo "[deploy] Deploy complete: IMAGE_TAG=${IMAGE_TAG}"
