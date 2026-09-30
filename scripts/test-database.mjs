import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";

const source = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost", "[::1]"].includes(source.hostname)) throw new Error("Este comando prepara somente banco local de testes.");
const admin = new pg.Client({ connectionString: source.href });
await admin.connect();
try {
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname='morethis_test'");
  if (!exists.rowCount) await admin.query('CREATE DATABASE "morethis_test"');
} finally { await admin.end(); }
source.pathname = "/morethis_test";
let secret = randomBytes(48).toString("base64url");
try { const old = await readFile(".env.test", "utf8"); secret = old.match(/^BETTER_AUTH_SECRET=(.+)$/m)?.[1] ?? secret; } catch (error) { if (error.code !== "ENOENT") throw error; }
await writeFile(".env.test", `DATABASE_URL=${source.href}\nTEST_DATABASE_URL=${source.href}\nBETTER_AUTH_URL=http://127.0.0.1:3100\nBETTER_AUTH_SECRET=${secret}\n`, { mode: 0o600 });
const migration = spawnSync(process.execPath, ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: source.href }, stdio: "inherit" });
if (migration.status !== 0) process.exit(migration.status ?? 1);
console.log("Banco morethis_test preparado sem apagar dados existentes. Segredos não exibidos.");
