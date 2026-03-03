#!/usr/bin/env bash
# ProtoPulse Database Backup Script
#
# Usage: ./scripts/backup.sh [output_dir]
#
# Requires: DATABASE_URL environment variable (or .env file in project root)
# Creates timestamped compressed SQL dump: protopulse_backup_YYYYMMDD_HHMMSS.sql.gz
#
# Exit codes:
#   0  Success
#   1  Configuration error (missing DATABASE_URL, missing tools)
#   2  pg_dump or compression error

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${1:-${PROJECT_ROOT}/backups}"
RETENTION_COUNT=7
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="protopulse_backup_${TIMESTAMP}.sql.gz"

# ── Helpers ──────────────────────────────────────────────────────────────

log_info() {
  printf '[INFO]  %s  %s\n' "$(date +%Y-%m-%dT%H:%M:%S%z)" "$1"
}

log_error() {
  printf '[ERROR] %s  %s\n' "$(date +%Y-%m-%dT%H:%M:%S%z)" "$1" >&2
}

# ── Prerequisite checks ─────────────────────────────────────────────────

for cmd in pg_dump gzip; do
  if ! command -v "$cmd" &>/dev/null; then
    log_error "Required command not found: $cmd"
    exit 1
  fi
done

# ── Load DATABASE_URL ────────────────────────────────────────────────────

if [[ -z "${DATABASE_URL:-}" ]]; then
  ENV_FILE="${PROJECT_ROOT}/.env"
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a
    source "$ENV_FILE"
    set +a
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  log_error "DATABASE_URL is not set. Export it or add it to ${PROJECT_ROOT}/.env"
  exit 1
fi

# ── Parse DATABASE_URL ───────────────────────────────────────────────────

# Expected format: postgresql://user:password@host:port/dbname
# Strip the protocol prefix
_stripped="${DATABASE_URL#*://}"
_userpass="${_stripped%%@*}"
_hostportdb="${_stripped#*@}"

PGUSER="${_userpass%%:*}"
PGPASSWORD="${_userpass#*:}"
PGHOST="${_hostportdb%%:*}"
_portdb="${_hostportdb#*:}"
PGPORT="${_portdb%%/*}"
PGDATABASE="${_portdb#*/}"
# Strip any query parameters from database name
PGDATABASE="${PGDATABASE%%\?*}"

export PGPASSWORD

# ── Create output directory ──────────────────────────────────────────────

mkdir -p "$OUTPUT_DIR"

BACKUP_PATH="${OUTPUT_DIR}/${BACKUP_FILE}"

# ── Execute backup ───────────────────────────────────────────────────────

log_info "Starting backup of database '${PGDATABASE}' on ${PGHOST}:${PGPORT}"
log_info "Output: ${BACKUP_PATH}"

START_TIME=$(date +%s)

if ! pg_dump \
  -h "$PGHOST" \
  -p "$PGPORT" \
  -U "$PGUSER" \
  -d "$PGDATABASE" \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip -c > "$BACKUP_PATH"; then
  log_error "pg_dump or gzip failed"
  rm -f "$BACKUP_PATH"
  exit 2
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
BACKUP_SIZE=$(stat --printf='%s' "$BACKUP_PATH" 2>/dev/null || stat -f '%z' "$BACKUP_PATH" 2>/dev/null || echo "unknown")

log_info "Backup complete in ${DURATION}s"
log_info "File: ${BACKUP_PATH}"
log_info "Size: ${BACKUP_SIZE} bytes"

# ── Retention: keep only the most recent $RETENTION_COUNT backups ────────

BACKUP_COUNT=$(find "$OUTPUT_DIR" -maxdepth 1 -name 'protopulse_backup_*.sql.gz' -type f | wc -l)

if [[ "$BACKUP_COUNT" -gt "$RETENTION_COUNT" ]]; then
  DELETE_COUNT=$((BACKUP_COUNT - RETENTION_COUNT))
  log_info "Pruning ${DELETE_COUNT} old backup(s) (retention: ${RETENTION_COUNT})"
  find "$OUTPUT_DIR" -maxdepth 1 -name 'protopulse_backup_*.sql.gz' -type f -printf '%T@ %p\n' \
    | sort -n \
    | head -n "$DELETE_COUNT" \
    | awk '{print $2}' \
    | xargs rm -f
fi

log_info "Done."
