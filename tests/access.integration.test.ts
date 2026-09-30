import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { mutateWorkspace, readWorkspace } from "../src/server/workspace";
import { requireAccess } from "../src/server/access";
import type { Actor } from "../src/server/session";

if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL obrigatória.");
const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const actors: Actor[] = Array.from({ length: 4 }, (_, i) => { const id = randomUUID(); return { id, name: `Teste ${i}`, email: `${id}@example.test` }; });
const [owner, other, staff, secondOwner] = actors;
let org: string; let orgB: string; let unit: string; let unitB: string;
const extraUnit = randomUUID();
const key = randomUUID();
const onboarding = { action: "onboard", requestId: key, name: "Pastelaria teste", slug: `teste-${key}`, unitName: "Centro", timezone: "America/Sao_Paulo" };
beforeAll(async () => {
  for (const actor of actors) await db.query("INSERT INTO users(id,auth_subject,email,name) VALUES($1::uuid,$1::text,$2,$3)", [actor.id, actor.email, actor.name]);
  org = (await mutateWorkspace(db, owner, onboarding)).organizationId!;
  orgB = (await mutateWorkspace(db, other, { ...onboarding, requestId: randomUUID(), slug: `other-${key}` })).organizationId!;
  unit = (await readWorkspace(db, owner, org)).units[0].id;
  unitB = (await readWorkspace(db, other, orgB)).units[0].id;
  await mutateWorkspace(db, owner, { action: "unit.create", organizationId: org, unitId: extraUnit, name: "Bairro", timezone: "America/Manaus" });
});
afterAll(async () => {
  try {
    await db.query("DELETE FROM invitations WHERE organization_id IN(SELECT id FROM organizations WHERE created_by=ANY($1::uuid[]))", [actors.map((a) => a.id)]);
    await db.query("DELETE FROM audit_events WHERE organization_id IN(SELECT id FROM organizations WHERE created_by=ANY($1::uuid[]))", [actors.map((a) => a.id)]);
    await db.query("DELETE FROM organizations WHERE created_by=ANY($1::uuid[])", [actors.map((a) => a.id)]);
    await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [actors.map((a) => a.id)]);
  } finally { await db.end(); }
});

describe("acessos e unidades persistentes", () => {
  it("cria empresa, proprietário e unidade atomicamente; retry não duplica", async () => {
    const repeat = await mutateWorkspace(db, owner, onboarding);
    expect(repeat.organizationId).toBe(org);
    const count = await db.query("SELECT count(*)::int n FROM organizations WHERE creation_key=$1", [key]);
    expect(count.rows[0].n).toBe(1);
    await expect(mutateWorkspace(db, owner, { ...onboarding, name: "Outro nome" })).rejects.toMatchObject({ status: 409 });
  });
  it("nega leitura e alteração entre empresas", async () => {
    await expect(readWorkspace(db, other, org)).rejects.toMatchObject({ status: 403 });
    await expect(mutateWorkspace(db, other, { action: "unit.update", organizationId: org, unitId: unit, name: "Ataque", timezone: "UTC", version: 1 })).rejects.toMatchObject({ status: 403 });
  });
  it("rejeita referência a unidade de outra empresa e não deixa convite parcial", async () => {
    await expect(mutateWorkspace(db, owner, { action: "invitation.create", organizationId: org, email: staff.email, role: "kitchen", unitIds: [unitB] })).rejects.toMatchObject({ status: 403 });
    expect((await db.query("SELECT 1 FROM invitations WHERE organization_id=$1", [org])).rowCount).toBe(0);
  });
  it("banco também rejeita relacionamentos entre empresas", async () => {
    await expect(db.query("INSERT INTO unit_access(organization_id,unit_id,user_id) VALUES($1,$2,$3)", [org, unitB, owner.id])).rejects.toMatchObject({ code: "23503" });
  });
  it("convite exige destinatário correto, é reutilizável só pelo membro já aceito e não revela token persistido", async () => {
    const invitation = await mutateWorkspace(db, owner, { action: "invitation.create", organizationId: org, email: staff.email, role: "kitchen", unitIds: [unit] });
    const token = invitation.invitationToken!;
    expect(token).toHaveLength(64);
    await expect(mutateWorkspace(db, other, { action: "invitation.accept", token })).rejects.toMatchObject({ status: 400 });
    await mutateWorkspace(db, staff, { action: "invitation.accept", token });
    await mutateWorkspace(db, staff, { action: "invitation.accept", token });
    const stored = (await db.query("SELECT token_hash FROM invitations WHERE organization_id=$1", [org])).rows[0];
    expect(stored.token_hash).not.toBe(token);
    expect((await db.query("SELECT 1 FROM memberships WHERE organization_id=$1 AND user_id=$2", [org, staff.id])).rowCount).toBe(1);
  });
  it("cozinha vê apenas unidade atribuída; não recebe equipe, convites ou auditoria", async () => {
    const view = await readWorkspace(db, staff, org);
    expect(view.units.map((u) => u.id)).toEqual([unit]);
    expect(view.members).toEqual([]); expect(view.audit).toEqual([]); expect(view.invitations).toEqual([]);
    await expect(requireAccess(db, staff.id, org, "kitchen:work", unit)).resolves.toBe("kitchen");
    await expect(requireAccess(db, staff.id, org, "kitchen:work", extraUnit)).rejects.toMatchObject({ status: 403 });
    await expect(requireAccess(db, staff.id, org, "cash:manage", unit)).rejects.toMatchObject({ status: 403 });
  });
  it("não permite ao funcionário elevar privilégios", async () => {
    await expect(mutateWorkspace(db, staff, { action: "member.update", organizationId: org, userId: staff.id, role: "owner", unitIds: [], version: 1 })).rejects.toMatchObject({ status: 403 });
  });
  it("impede remover ou rebaixar último proprietário", async () => {
    await expect(mutateWorkspace(db, owner, { action: "member.remove", organizationId: org, userId: owner.id, version: 1 })).rejects.toMatchObject({ status: 409 });
    await expect(mutateWorkspace(db, owner, { action: "member.update", organizationId: org, userId: owner.id, version: 1, role: "manager", unitIds: [unit] })).rejects.toMatchObject({ status: 409 });
  });
  it("duas edições simultâneas da unidade não sobrescrevem silenciosamente", async () => {
    const requests = await Promise.allSettled(["Centro A", "Centro B"].map((name) => mutateWorkspace(db, owner, { action: "unit.update", organizationId: org, unitId: unit, version: 1, name, timezone: "America/Sao_Paulo" })));
    expect(requests.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(requests.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect((await db.query("SELECT version FROM units WHERE id=$1", [unit])).rows[0].version).toBe(2);
  });
  it("rejeita fuso inválido antes de persistir", async () => {
    await expect(mutateWorkspace(db, owner, { action: "unit.create", organizationId: org, unitId: randomUUID(), name: "Inválida", timezone: "Mars/Test" })).rejects.toMatchObject({ status: 400 });
  });
  it("revogação de unidade é imediata e auditada", async () => {
    await mutateWorkspace(db, owner, { action: "member.update", organizationId: org, userId: staff.id, version: 1, role: "manager", unitIds: [extraUnit] });
    await expect(requireAccess(db, staff.id, org, "units:manage", unit)).rejects.toMatchObject({ status: 403 });
    await expect(requireAccess(db, staff.id, org, "units:manage", extraUnit)).resolves.toBe("manager");
    expect((await readWorkspace(db, owner, org)).audit.some((a) => a.action === "member.update")).toBe(true);
  });
  it("convites revogados e expirados não concedem acesso", async () => {
    const created = await mutateWorkspace(db, owner, { action: "invitation.create", organizationId: org, email: secondOwner.email, role: "manager", unitIds: [unit] });
    const id = (await db.query("SELECT id FROM invitations WHERE organization_id=$1 AND email=$2 AND revoked_at IS NULL", [org, secondOwner.email])).rows[0].id;
    await mutateWorkspace(db, owner, { action: "invitation.revoke", organizationId: org, invitationId: id });
    await expect(mutateWorkspace(db, secondOwner, { action: "invitation.accept", token: created.invitationToken })).rejects.toMatchObject({ status: 400 });
    const newer = await mutateWorkspace(db, owner, { action: "invitation.create", organizationId: org, email: secondOwner.email, role: "manager", unitIds: [unit] });
    await db.query("UPDATE invitations SET expires_at=now()-interval '1 minute' WHERE organization_id=$1 AND email=$2", [org, secondOwner.email]);
    await expect(mutateWorkspace(db, secondOwner, { action: "invitation.accept", token: newer.invitationToken })).rejects.toMatchObject({ status: 400 });
  });
  it("duas tentativas simultâneas de rebaixar proprietários mantêm um proprietário", async () => {
    await db.query("INSERT INTO memberships(organization_id,user_id,role) VALUES($1,$2,'owner')", [org, secondOwner.id]);
    const requests = await Promise.allSettled([owner, secondOwner].map((actor) => mutateWorkspace(db, actor, { action: "member.update", organizationId: org, userId: actor.id, role: "manager", unitIds: [unit], version: 1 })));
    expect(requests.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.query("SELECT 1 FROM memberships WHERE organization_id=$1 AND role='owner'", [org])).rowCount).toBe(1);
  });
});
