import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
vi.mock("server-only", () => ({}));
import { requireOrganization } from "../src/server/organizations";

// Explicit opt-in: use a disposable/local database with migrations already applied.
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Defina TEST_DATABASE_URL para um banco de testes com as migrações aplicadas.");
const db = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
const userId = randomUUID();
const orgA = randomUUID();
const orgB = randomUUID();

beforeAll(async () => {
  await db.query("INSERT INTO users (id, auth_subject, email) VALUES ($1, $2, $3)", [userId, userId, `${userId}@example.test`]);
  await db.query("INSERT INTO organizations (id, name, slug) VALUES ($1::uuid, 'A', $1::text), ($2::uuid, 'B', $2::text)", [orgA, orgB]);
  await db.query("INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'member')", [orgA, userId]);
});
afterAll(async () => {
  try {
    await db.query("DELETE FROM organizations WHERE id = ANY($1::uuid[])", [[orgA, orgB]]);
    await db.query("DELETE FROM users WHERE id = $1", [userId]);
  } finally { await db.end(); }
});

describe("isolamento entre empresas", () => {
  it("retorna a empresa vinculada ao usuário", async () => {
    expect((await requireOrganization(db, userId, orgA)).id).toBe(orgA);
  });
  it("nega acesso a outra empresa", async () => {
    await expect(requireOrganization(db, userId, orgB)).rejects.toThrow("FORBIDDEN");
  });
  it("nega ação administrativa de um membro", async () => {
    await expect(requireOrganization(db, userId, orgA, "members:manage")).rejects.toThrow("FORBIDDEN");
  });
});
