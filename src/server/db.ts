import "server-only";
import { Pool } from "pg";

const globalDb = globalThis as unknown as { db?: Pool };

export function getDb(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
  globalDb.db ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  return globalDb.db;
}
