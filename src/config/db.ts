import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
}

export async function checkDBHealth(): Promise<boolean> {
  // Allow bypassing DB health checks for local development or when the
  // configured database is temporarily unreachable. Set `SKIP_DB_HEALTH=true`
  // in the environment to make `/health` and `/ready` return healthy.
  if (process.env.SKIP_DB_HEALTH === 'true') return true;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    // If Prisma can't reach the configured database, allow a local SQLite
    // fallback when `FALLBACK_SQLITE=true` is set in the environment. This
    // enables local development and health checks when the primary DB is
    // unreachable (e.g., DNS issues for Supabase).
    if (process.env.FALLBACK_SQLITE === 'true') {
      try {
        // Use a lightweight synchronous SQLite probe to avoid adding async
        // complexity here. `better-sqlite3` is a native dependency but
        // provides a simple, reliable API for local checks.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');
        const row = db.prepare('SELECT 1 as ok').get();
        db.close();
        return !!row && row.ok === 1;
      } catch (e) {
        return false;
      }
    }
    return false;
  }
}