#!/usr/bin/env bash
# ProtoPulse Database Restore Script
#
# Usage: ./scripts/restore.sh <backup_file> [--force]
#
# WARNING: This will OVERWRITE the current database!
#
# Supports: .sql, .sql.gz, .dump files
# Requires: DATABASE_URL environment variable (or .env file in project root)
#
# Exit codes:
#   0  Success
#   1  Configuration or argument error
#   2  Restore error

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FORCE=false

# ── Helpers ──────────────────────────────────────────────────────────────

log_info() {
  printf '[INFO]  %s  %s\n' "$(date +%Y-%m-%dT%H:%M:%S%z)" "$1"
}

log_error() {
  printf '[ERROR] %s  %s\n' "$(date +%Y-%m-%dT%H:%M:%S%z)" "$1" >&2
}

log_warn() {
  printf '[WARN]  %s  %s\n' "$(date +%Y-%m-%dT%H:%M:%S%z)" "$1" >&2
}

usage() {
  echo "Usage: $0 <backup_file> [--force]"
  echo ""
  echo "  backup_file   Path to .sql, .sql.gz, or .dump backup file"
  echo "  --force       Skip interactive confirmation (for automation)"
  echo ""
  echo "WARNING: This will OVERWRITE the current database!"
  exit 1
}

# ── Argument parsing ─────────────────────────────────────────────────────

BACKUP_FILE=""

for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE=true
      ;;
    --help|-h)
      usage
      ;;
    *)
      if [[ -z "$BACKUP_FILE" ]]; then
        BACKUP_FILE="$arg"
      else
        log_error "Unexpected argument: $arg"
        usage
      fi
      ;;
  esac
done

if [[ -z "$BACKUP_FILE" ]]; then
  log_error "No backup file specified"
  usage
fi

# ── Validate backup file ────────────────────────────────────────────────

if [[ ! -f "$BACKUP_FILE" ]]; then
  log_error "Backup file not found: $BACKUP_FILE"
  exit 1
fi

if [[ ! -r "$BACKUP_FILE" ]]; then
  log_error "Backup file is not readable: $BACKUP_FILE"
  exit 1
fi

FILE_SIZE=$(stat --printf='%s' "$BACKUP_FILE" 2>/dev/null || stat -f '%z' "$BACKUP_FILE" 2>/dev/null || echo "unknown")
log_info "Backup file: ${BACKUP_FILE} (${FILE_SIZE} bytes)"

# Determine file type
case "$BACKUP_FILE" in
  *.sql.gz)
    FILE_TYPE="sql_gzip"
    ;;
  *.sql)
    FILE_TYPE="sql_plain"
    ;;
  *.dump)
    FILE_TYPE="custom"
    ;;
  *)
    log_error "Unsupported file extension. Expected .sql, .sql.gz, or .dump"
    exit 1
    ;;
esac

log_info "Detected format: ${FILE_TYPE}"

# ── Prerequisite checks ─────────────────────────────────────────────────

REQUIRED_CMDS=(psql)
if [[ "$FILE_TYPE" == "sql_gzip" ]]; then
  REQUIRED_CMDS+=(gunzip)
fi
if [[ "$FILE_TYPE" == "custom" ]]; then
  REQUIRED_CMDS=(pg_restore)
fi

for cmd in "${REQUIRED_CMDS[@]}"; do
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

_stripped="${DATABASE_URL#*://}"
_userpass="${_stripped%%@*}"
_hostportdb="${_stripped#*@}"

PGUSER="${_userpass%%:*}"
PGPASSWORD="${_userpass#*:}"
PGHOST="${_hostportdb%%:*}"
_portdb="${_hostportdb#*:}"
PGPORT="${_portdb%%/*}"
PGDATABASE="${_portdb#*/}"
PGDATABASE="${PGDATABASE%%\?*}"

export PGPASSWORD

# ── Confirmation ─────────────────────────────────────────────────────────

log_warn "This will RESTORE database '${PGDATABASE}' on ${PGHOST}:${PGPORT}"
log_warn "ALL EXISTING DATA may be overwritten!"

if [[ "$FORCE" != true ]]; then
  printf '\nType YES to proceed: '
  read -r CONFIRM
  if [[ "$CONFIRM" != "YES" ]]; then
    log_info "Restore cancelled by user"
    exit 0
  fi
fi

# ── Execute restore ──────────────────────────────────────────────────────

log_info "Starting restore..."
START_TIME=$(date +%s)

case "$FILE_TYPE" in
  sql_plain)
    if ! psql \
      -h "$PGHOST" \
      -p "$PGPORT" \
      -U "$PGUSER" \
      -d "$PGDATABASE" \
      -v ON_ERROR_STOP=1 \
      -f "$BACKUP_FILE"; then
      log_error "psql restore failed"
      exit 2
    fi
    ;;
  sql_gzip)
    if ! gunzip -c "$BACKUP_FILE" | psql \
      -h "$PGHOST" \
      -p "$PGPORT" \
      -U "$PGUSER" \
      -d "$PGDATABASE" \
      -v ON_ERROR_STOP=1; then
      log_error "Decompression or psql restore failed"
      exit 2
    fi
    ;;
  custom)
    if ! pg_restore \
      -h "$PGHOST" \
      -p "$PGPORT" \
      -U "$PGUSER" \
      -d "$PGDATABASE" \
      --no-owner \
      --no-privileges \
      --clean \
      --if-exists \
      "$BACKUP_FILE"; then
      log_error "pg_restore failed"
      exit 2
    fi
    ;;
esac

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log_info "Restore complete in ${DURATION}s"

# ── Post-restore verification ────────────────────────────────────────────

log_info "Verifying restored data (table row counts):"

psql \
  -h "$PGHOST" \
  -p "$PGPORT" \
  -U "$PGUSER" \
  -d "$PGDATABASE" \
  -c "SELECT relname AS table_name, n_live_tup AS row_count
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC;" \
  --no-align --tuples-only 2>/dev/null | while IFS='|' read -r tbl cnt; do
    if [[ -n "$tbl" ]]; then
      printf '  %-40s %s rows\n' "$tbl" "$cnt"
    fi
  done

log_info "Done. Please verify the application is working correctly."
