#!/usr/bin/env bash
#
# PROJECT DREXDEL - DATABASE BACKUP
# Creates a compressed PostgreSQL dump of the production database.
#
# Uses the standard PostgreSQL client tools (pg_dump). Set the target
# connection via DATABASE_URL (preferred) or individual PG* variables.
# The dump is written to ./backups/dump-<timestamp>.sql.gz
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

# Compose the pg_dump connection flags from DATABASE_URL when available.
if [[ -n "${DATABASE_URL:-}" ]]; then
  PG_CONN="$DATABASE_URL"
else
  PGHOST="${PGHOST:-localhost}"
  PGPORT="${PGPORT:-5432}"
  PGUSER="${PGUSER:-postgres}"
  PGDATABASE="${PGDATABASE:-drexdel}"
  if [[ -n "${PGPASSWORD:-}" ]]; then
    export PGPASSWORD
  fi
  PG_CONN="postgresql://$PGUSER@localhost:$PGPORT/$PGDATABASE"
fi

# Extract the database name from the URL for the file label.
DB_NAME=$(echo "$PG_CONN" | sed -E 's|.*://[^/]+/||; s|(\?.*)?$||')
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
FILE="$BACKUP_DIR/dump-${DB_NAME:-drexdel}-${TIMESTAMP}.sql.gz"

echo "[db:backup] Dumping $DB_NAME -> $FILE"
pg_dump --verbose --clean --if-exists --no-owner --no-privileges "$PG_CONN" | gzip > "$FILE"

echo "[db:backup] Done: $FILE ($(du -h "$FILE" | cut -f1))"
