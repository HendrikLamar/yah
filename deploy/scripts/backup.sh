#!/usr/bin/env bash
# backup.sh — nightly logical backup of the yah production database.
# Cron (igor): 0 3 * * * bash /opt/yah/scripts/backup.sh >> /opt/yah/backups/backup.log 2>&1
set -euo pipefail

BACKUP_DIR=/opt/yah/backups
KEEP=14

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/yah-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
echo "[backup] $(date -u +%Y-%m-%dT%H:%M:%SZ) dumping to $OUT"
docker exec supabase-db pg_dump -U postgres -d postgres | gzip > "$OUT"

# Keep the newest $KEEP of each series (nightly dumps + deploy-time snapshots).
ls -1t "$BACKUP_DIR"/yah-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --
ls -1t "$BACKUP_DIR"/pre-migrate-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --
echo "[backup] done"
