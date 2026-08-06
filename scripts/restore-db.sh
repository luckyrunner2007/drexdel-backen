#!/usr/bin/env bash
#
# PROJECT DREXDEL - DATABASE RESTORE
# Restores a compressed PostgreSQL dump into the target database.
#
# Usage:
#   ./scripts/restore-db.sh path/to/dump.sql.gz
#
# WARNING: This drops and recreates objects in the target database. Only run
# against a database you intend to overwrite. For production, take a fresh
# backup before restoring to avoid data loss.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 path/to/dump.sql.gz"
  exit 1
fi

DUMP_FILE="$1"
if [[ ! -f "$DUMP_FILE" ]]; then
  echo "[db:restore] File not found: $DUMP_FILE"
  exit 1
fi

# Build the connection string the same way as backup-db.sh.
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

echo "[db:restore] Restoring $DUMP_FILE -> $PG_CONN"
gunzip -c "$DUMP_FILE" | psql --single-transaction --set ON_ERROR_STOP=1 "$PG_CONN"

echo "[db:restore] Done."
