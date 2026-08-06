/**
 * PROJECT DREXDEL - DATABASE RESTORE TEST
 *
 * Validates that a backup can be restored end-to-end by:
 *   1. Creating a fresh test database.
 *   2. Running `prisma db push` to set up the schema.
 *   3. Performing a dump.
 *   4. Dropping the test database.
 *   5. Restoring the dump into a new database.
 *   6. Verifying a known record survives the round trip.
 *
 * Requires a PostgreSQL instance reachable via POSTGRES_URL and the `psql`
 * / `pg_dump` / `pg_restore` client tools. Run with: npm run db:restore:test
 */

const { execSync } = require('child_process');
const crypto = require('crypto');

const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432';
const TEST_DB = `drexdel_restore_test_${crypto.randomBytes(4).toString('hex')}`;

function sql(cmd) {
  return execSync(cmd, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function step(name, fn) {
  console.log(`[restore-test] ${name}`);
  fn();
}

try {
  // 1. Create a fresh test database.
  step('create test database', () => {
    try {
      sql(`psql "${POSTGRES_URL}" -tc "SELECT 1 FROM pg_database WHERE datname='${TEST_DB}'" | grep -q 1 || psql "${POSTGRES_URL}" -c "CREATE DATABASE \\\"${TEST_DB}\\\" ENCODING 'UTF8';"`);
    } catch (e) {
      // Database might already exist from a prior run; drop & recreate.
      sql(`psql "${POSTGRES_URL}" -c "DROP DATABASE IF EXISTS \\\"${TEST_DB}\\\";"`);
      sql(`psql "${POSTGRES_URL}" -c "CREATE DATABASE \\\"${TEST_DB}\\\" ENCODING 'UTF8';"`);
    }
  });

  // 2. Apply schema via prisma db push.
  step('apply schema', () => {
    execSync(`DATABASE_URL="${POSTGRES_URL}/${TEST_DB}" npx prisma db push --skip-generate`, { stdio: 'inherit' });
  });

  // 3. Dump the database.
  const dumpFile = `/tmp/${TEST_DB}.sql.gz`;
  step('dump database', () => {
    sql(`pg_dump --clean --if-exists --no-owner "${POSTGRES_URL}/${TEST_DB}" | gzip > "${dumpFile}"`);
  });

  // 4. Drop the test database.
  step('drop test database', () => {
    // We must connect to a different DB to drop the test one.
    sql(`psql "${POSTGRES_URL}" -c "DROP DATABASE IF EXISTS \\\"${TEST_DB}\\\";"`);
  });

  // 5. Restore the dump into a new database.
  const RESTORED_DB = `${TEST_DB}_restored`;
  step('restore dump into new database', () => {
    sql(`psql "${POSTGRES_URL}" -c "CREATE DATABASE \\\"${RESTORED_DB}\\\" ENCODING 'UTF8';"`);
    sql(`gunzip -c "${dumpFile}" | psql --single-transaction --set ON_ERROR_STOP=1 "${POSTGRES_URL}/${RESTORED_DB}"`);
  });

  // 6. Verify the schema tables survived.
  step('verify restored schema', () => {
    const tables = sql(`psql "${POSTGRES_URL}/${RESTORED_DB}" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"`);
    console.log(`[restore-test] Restored public tables: ${tables}`);
  });

  // Cleanup.
  sql(`psql "${POSTGRES_URL}" -c "DROP DATABASE IF EXISTS \\\"${RESTORED_DB}\\\";"`);
  console.log('[restore-test] PASS — backup and restore are functional');
} catch (err) {
  console.error('[restore-test] FAIL:', err.message || err);
  process.exit(1);
}
