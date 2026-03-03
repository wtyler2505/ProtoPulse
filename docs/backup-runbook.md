# ProtoPulse Backup & Recovery Runbook

## Overview

This document describes the backup and recovery procedures for ProtoPulse's PostgreSQL database. All project data -- architecture diagrams, BOM items, circuit designs, chat history, user accounts, and AI action logs -- lives in a single PostgreSQL database.

**Recovery objectives:**

| Metric | Target | Notes |
| ------ | ------ | ----- |
| RPO (Recovery Point Objective) | Depends on backup frequency | Daily cron = up to 24h of data loss |
| RTO (Recovery Time Objective) | ~5 minutes | Database restore + application restart |

## Prerequisites

- **PostgreSQL client tools**: `pg_dump`, `psql`, `pg_restore` (install via `apt install postgresql-client` or equivalent)
- **gzip/gunzip**: For compressed backups
- **DATABASE_URL**: PostgreSQL connection string (set in environment or `.env` file)
- **ADMIN_API_KEY**: Required for API-based backup/restore endpoints

## Backup Methods

### Method 1: API Endpoint

Trigger a backup via the admin API. The dump streams directly as the HTTP response body.

```bash
# SQL format (plain text)
curl -s -X POST \
  -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  "http://localhost:5000/api/admin/backup?format=sql" \
  -o "protopulse_backup_$(date +%Y%m%d_%H%M%S).sql"

# SQL format, gzip compressed
curl -s -X POST \
  -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  "http://localhost:5000/api/admin/backup?format=sql&compressed=true" \
  -o "protopulse_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# Custom format (pg_restore compatible, smaller)
curl -s -X POST \
  -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  "http://localhost:5000/api/admin/backup?format=custom" \
  -o "protopulse_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### Method 2: Backup Script

The included shell script handles timestamping, compression, and retention.

```bash
# Default output to ./backups/
./scripts/backup.sh

# Custom output directory
./scripts/backup.sh /mnt/backups/protopulse
```

Features:
- Reads `DATABASE_URL` from environment or `.env` file
- Creates timestamped gzip-compressed dumps: `protopulse_backup_YYYYMMDD_HHMMSS.sql.gz`
- Automatic retention: keeps the 7 most recent backups, deletes older ones
- Clear exit codes: 0 (success), 1 (config error), 2 (dump error)

### Method 3: Direct pg_dump

For full control or custom scenarios.

```bash
# Plain SQL dump
pg_dump "$DATABASE_URL" --format=plain --no-owner --no-privileges \
  > "protopulse_backup_$(date +%Y%m%d_%H%M%S).sql"

# Compressed SQL dump
pg_dump "$DATABASE_URL" --format=plain --no-owner --no-privileges \
  | gzip -c > "protopulse_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# Custom format (supports selective restore)
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges \
  -f "protopulse_backup_$(date +%Y%m%d_%H%M%S).dump"
```

## Automated Backup (Cron)

### Daily backup at 2:00 AM

```cron
0 2 * * * cd /path/to/protopulse && ./scripts/backup.sh /mnt/backups/protopulse >> /var/log/protopulse-backup.log 2>&1
```

### Daily + weekly retention

```cron
# Daily backup (retention handled by script: keeps last 7)
0 2 * * * cd /path/to/protopulse && ./scripts/backup.sh /mnt/backups/daily >> /var/log/protopulse-backup.log 2>&1

# Weekly backup to separate directory (keep last 4 weeks manually)
0 3 * * 0 cd /path/to/protopulse && ./scripts/backup.sh /mnt/backups/weekly >> /var/log/protopulse-backup.log 2>&1
```

### Verify cron is working

```bash
# Check recent backup files
ls -lht /mnt/backups/protopulse/ | head -5

# Check cron logs
grep protopulse /var/log/syslog | tail -10
```

## Check Database Status

Before restoring, check current database state via the API:

```bash
curl -s -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  "http://localhost:5000/api/admin/backup/status" | jq .
```

Response:

```json
{
  "databaseSize": "42 MB",
  "totalRows": 12345,
  "tables": [
    { "table_name": "chat_messages", "row_count": "5432" },
    { "table_name": "architecture_nodes", "row_count": "2100" }
  ],
  "timestamp": "2026-03-03T12:00:00.000Z"
}
```

## Restore Procedures

### Scenario 1: Full Database Restore (Script)

Use the restore script for the standard case.

```bash
# Interactive (prompts for confirmation)
./scripts/restore.sh ./backups/protopulse_backup_20260303_020000.sql.gz

# Non-interactive (for automation)
./scripts/restore.sh ./backups/protopulse_backup_20260303_020000.sql.gz --force
```

Supported formats: `.sql`, `.sql.gz`, `.dump`

**Steps:**

1. Stop the ProtoPulse application (optional but recommended for consistency)
2. Run the restore script
3. Type `YES` when prompted
4. Verify the table row counts printed after restore
5. Restart the application
6. Verify via `/api/admin/backup/status`

### Scenario 2: Full Database Restore (API)

```bash
# Restore from a SQL dump via the API
curl -s -X POST \
  -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"confirm\": \"RESTORE\", \"sql\": $(jq -Rs . < protopulse_backup.sql)}" \
  "http://localhost:5000/api/admin/restore" | jq .
```

**Note:** The API endpoint has a 100 MB payload limit. For larger dumps, use the script or direct psql.

### Scenario 3: Single Table Restore

When you only need to restore specific tables from a custom-format dump:

```bash
# List tables in a custom dump
pg_restore --list protopulse_backup.dump | grep "TABLE DATA"

# Restore only the bom_items table
pg_restore -h localhost -p 5432 -U protopulse -d protopulse \
  --no-owner --no-privileges --clean --if-exists \
  -t bom_items \
  protopulse_backup.dump

# Restore multiple specific tables
pg_restore -h localhost -p 5432 -U protopulse -d protopulse \
  --no-owner --no-privileges --clean --if-exists \
  -t architecture_nodes -t architecture_edges \
  protopulse_backup.dump
```

### Scenario 4: Point-in-Time Recovery

Requires PostgreSQL WAL (Write-Ahead Log) archiving to be configured at the database server level. This is a PostgreSQL server configuration, not application-level.

**If WAL archiving is configured:**

1. Stop PostgreSQL
2. Replace the data directory with the base backup
3. Configure `recovery.conf` (or `postgresql.conf` for PG 12+):
   ```
   restore_command = 'cp /path/to/wal_archive/%f %p'
   recovery_target_time = '2026-03-03 10:00:00'
   ```
4. Start PostgreSQL -- it replays WAL up to the target time
5. Promote to primary when satisfied: `pg_ctl promote`

**If WAL archiving is NOT configured:**

WAL-based recovery is not available. You can only restore from the most recent dump. Consider enabling WAL archiving if RPO < 24h is required. See the [PostgreSQL documentation on Continuous Archiving](https://www.postgresql.org/docs/current/continuous-archiving.html).

## Verification Checklist

Run these checks after every restore:

- [ ] `/api/admin/backup/status` returns expected table counts
- [ ] Application starts without errors (`npm start` or `npm run dev`)
- [ ] Can log in with existing user credentials
- [ ] Architecture view loads nodes and edges
- [ ] BOM items display correctly
- [ ] Chat history is intact
- [ ] Circuit designs load in the schematic editor
- [ ] AI chat responds (tests that API key encryption is intact)
- [ ] No error logs in application output

Quick smoke test:

```bash
# Check the app is responding
curl -s http://localhost:5000/api/projects | jq '.[0].name'

# Check database connectivity
curl -s -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  http://localhost:5000/api/admin/backup/status | jq .databaseSize
```

## Disaster Recovery

### Complete Database Loss

1. Provision a new PostgreSQL instance
2. Set `DATABASE_URL` to the new instance
3. Run schema migration: `npm run db:push`
4. Restore from most recent backup:
   ```bash
   ./scripts/restore.sh /mnt/backups/protopulse/protopulse_backup_latest.sql.gz --force
   ```
5. Run verification checklist above
6. Update DNS/config to point to the new instance if needed

### Corrupted Database

1. Attempt a backup of the corrupted state (best effort):
   ```bash
   pg_dump "$DATABASE_URL" --format=plain > corrupted_state_$(date +%Y%m%d).sql 2>&1 || true
   ```
2. Drop and recreate the database:
   ```bash
   psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   ```
3. Push the schema: `npm run db:push`
4. Restore from the last known good backup
5. If no good backup exists, the schema push gives you an empty but functional database

### Accidental Data Deletion

If soft-deleted (ProtoPulse uses soft deletes for projects, nodes, edges, BOM items):

- Data is still in the database with a non-null `deletedAt` timestamp
- Query directly: `SELECT * FROM projects WHERE deleted_at IS NOT NULL;`
- Restore by setting `deleted_at` back to NULL

If hard-deleted or the purge endpoint was used:

- Restore from the most recent backup using single-table restore (Scenario 3)
- Or perform a full restore if multiple tables are affected

## Monitoring

### Backup Health Checks

Add these to your monitoring system:

```bash
# Check that a backup was created in the last 25 hours
LATEST=$(find /mnt/backups/protopulse -name 'protopulse_backup_*.sql.gz' -mmin -1500 | head -1)
if [[ -z "$LATEST" ]]; then
  echo "ALERT: No backup in the last 25 hours!"
  exit 1
fi

# Check that the backup is non-trivially sized (>1KB)
SIZE=$(stat --printf='%s' "$LATEST" 2>/dev/null || stat -f '%z' "$LATEST")
if [[ "$SIZE" -lt 1024 ]]; then
  echo "ALERT: Latest backup is suspiciously small (${SIZE} bytes)"
  exit 1
fi

echo "OK: Latest backup is $LATEST (${SIZE} bytes)"
```

### Storage Space

```bash
# Check backup directory size
du -sh /mnt/backups/protopulse/

# Check database size via API
curl -s -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  http://localhost:5000/api/admin/backup/status | jq .databaseSize
```

### Alert Thresholds

| Metric | Warning | Critical |
| ------ | ------- | -------- |
| Time since last backup | > 25 hours | > 48 hours |
| Backup file size | < 1 KB | 0 bytes / missing |
| Backup directory usage | > 80% of disk | > 95% of disk |
| Database size growth | > 50% month-over-month | > 100% month-over-month |
