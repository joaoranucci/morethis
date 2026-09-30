import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { can, type Role } from "../lib/permissions";
import { workspaceAction } from "../lib/workspace-schema";
import { requireAccess } from "./access";
import { DomainError } from "./errors";
import type { Actor } from "./session";

export type Unit = { id: string; name: string; timezone: string; version: number };
export type Membership = { user_id: string; name: string; email: string; role: Role; version: number; unit_ids: string[] };
export type Workspace = {
  actor: Actor;
  organizations: { id: string; name: string; slug: string; role: Role; version: number }[];
  selectedId: string | null;
  units: Unit[];
  members: Membership[];
  invitations: { id: string; email: string; role: Role; expires_at: string; accepted_at: string | null; revoked_at: string | null }[];
  audit: { id: string; action: string; created_at: string; details: Record<string, unknown> }[];
};

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function audit(db: PoolClient, org: string, actor: string, action: string, details: object, unit?: string) {
  await db.query("INSERT INTO audit_events(organization_id,actor_id,action,details,unit_id) VALUES($1,$2,$3,$4,$5)", [org, actor, action, details, unit ?? null]);
}
async function validateUnits(db: PoolClient, org: string, ids: string[]) {
  const found = await db.query("SELECT id FROM units WHERE organization_id=$1 AND id=ANY($2::uuid[])", [org, ids]);
  if (found.rowCount !== new Set(ids).size) throw new DomainError(403, "Uma das unidades não pertence à empresa.");
}

export async function readWorkspace(db: Pool, actor: Actor, selectedId?: string): Promise<Workspace> {
  // One repeatable snapshot prevents a concurrent revocation from exposing later queries.
  const client = await db.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const organizations = (await client.query<Workspace["organizations"][number]>(
      `SELECT o.id,o.name,o.slug,o.version,m.role FROM organizations o JOIN memberships m ON m.organization_id=o.id WHERE m.user_id=$1 ORDER BY o.name`, [actor.id],
    )).rows;
    const selected = selectedId ? organizations.find((o) => o.id === selectedId) : organizations[0];
    if (selectedId && !selected) throw new DomainError(403, "Empresa indisponível para seu usuário.");
    const data: Workspace = { actor, organizations, selectedId: selected?.id ?? null, units: [], members: [], invitations: [], audit: [] };
    if (selected) {
      data.units = (await client.query<Unit>(
        `SELECT u.id,u.name,u.timezone,u.version FROM units u WHERE u.organization_id=$1
         AND ($3='owner' OR EXISTS(SELECT 1 FROM unit_access a WHERE a.organization_id=u.organization_id AND a.unit_id=u.id AND a.user_id=$2)) ORDER BY u.name`,
        [selected.id, actor.id, selected.role],
      )).rows;
      if (selected.role === "owner") {
        data.members = (await client.query<Membership>(
          `SELECT m.user_id,u.name,u.email,m.role,m.version,
          ARRAY(SELECT a.unit_id::text FROM unit_access a WHERE a.organization_id=m.organization_id AND a.user_id=m.user_id ORDER BY a.unit_id) AS unit_ids
          FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 ORDER BY u.name`, [selected.id],
        )).rows;
        data.invitations = (await client.query<Workspace["invitations"][number]>(
          "SELECT id,email,role,expires_at,accepted_at,revoked_at FROM invitations WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 50", [selected.id],
        )).rows;
      }
      if (can(selected.role, "audit:read")) {
        data.audit = (await client.query<Workspace["audit"][number]>(
          `SELECT id::text,action,created_at,details FROM audit_events WHERE organization_id=$1
           AND ($2='owner' OR unit_id=ANY($3::uuid[])) ORDER BY id DESC LIMIT 50`, [selected.id, selected.role, data.units.map((u) => u.id)],
        )).rows;
      }
    }
    await client.query("COMMIT");
    return data;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export async function mutateWorkspace(db: Pool, actor: Actor, input: unknown): Promise<{ organizationId?: string; invitationToken?: string }> {
  const parsed = workspaceAction.safeParse(input);
  if (!parsed.success) throw new DomainError(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const data = parsed.data;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    let result: { organizationId?: string; invitationToken?: string } = {};
    if (data.action === "onboard") {
      // Serialize onboarding for this actor, including identical retries.
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [actor.id]);
      const fingerprint = hash(JSON.stringify(data));
      const existing = await client.query("SELECT id,creation_hash FROM organizations WHERE created_by=$1 AND creation_key=$2", [actor.id, data.requestId]);
      if (existing.rowCount) {
        if (existing.rows[0].creation_hash !== fingerprint) throw new DomainError(409, "Esta tentativa já foi usada com outros dados.");
        result = { organizationId: existing.rows[0].id };
      } else {
        const org = (await client.query("INSERT INTO organizations(name,slug,created_by,creation_key,creation_hash) VALUES($1,$2,$3,$4,$5) RETURNING id", [data.name, data.slug, actor.id, data.requestId, fingerprint])).rows[0].id;
        await client.query("INSERT INTO memberships(organization_id,user_id,role) VALUES($1,$2,'owner')", [org, actor.id]);
        const unit = (await client.query("INSERT INTO units(organization_id,name,timezone) VALUES($1,$2,$3) RETURNING id", [org, data.unitName, data.timezone])).rows[0].id;
        await audit(client, org, actor.id, data.action, { name: data.name, unitName: data.unitName }, unit);
        result = { organizationId: org };
      }
    } else if (data.action === "invitation.accept") {
      // Lock organization before invitation to match all membership mutations.
      const preliminary = await client.query("SELECT organization_id FROM invitations WHERE token_hash=$1", [hash(data.token)]);
      if (!preliminary.rowCount) throw new DomainError(400, "Convite inválido ou indisponível.");
      const org = preliminary.rows[0].organization_id;
      await client.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [org]);
      const invitation = (await client.query("SELECT * FROM invitations WHERE token_hash=$1 FOR UPDATE", [hash(data.token)])).rows[0];
      if (!invitation || invitation.email !== actor.email.toLowerCase() || invitation.revoked_at || new Date(invitation.expires_at) <= new Date()) throw new DomainError(400, "Convite inválido, expirado ou destinado a outro e-mail.");
      if (invitation.accepted_at) {
        const member = await client.query("SELECT 1 FROM memberships WHERE organization_id=$1 AND user_id=$2", [org, actor.id]);
        if (!member.rowCount) throw new DomainError(400, "Convite já utilizado.");
      } else {
        const existing = await client.query("SELECT 1 FROM memberships WHERE organization_id=$1 AND user_id=$2", [org, actor.id]);
        if (existing.rowCount) throw new DomainError(409, "Você já faz parte desta empresa. Peça ao proprietário para ajustar o acesso.");
        await client.query("INSERT INTO memberships(organization_id,user_id,role) VALUES($1,$2,$3)", [org, actor.id, invitation.role]);
        await client.query("INSERT INTO unit_access(organization_id,unit_id,user_id) SELECT organization_id,unit_id,$2 FROM invitation_units WHERE invitation_id=$1", [invitation.id, actor.id]);
        await client.query("UPDATE invitations SET accepted_at=now() WHERE id=$1", [invitation.id]);
        await audit(client, org, actor.id, data.action, { invitationId: invitation.id, role: invitation.role });
      }
      result = { organizationId: org };
    } else {
      const org = data.organizationId;
      // All business membership/settings mutations serialize on the organization.
      await client.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [org]);
      const role = await requireAccess(client, actor.id, org, "organization:read");
      if (data.action === "unit.update") {
        await requireAccess(client, actor.id, org, "units:manage", data.unitId);
        const updated = await client.query("UPDATE units SET name=$1,timezone=$2,version=version+1 WHERE organization_id=$3 AND id=$4 AND version=$5 RETURNING id", [data.name, data.timezone, org, data.unitId, data.version]);
        if (!updated.rowCount) throw new DomainError(409, "A unidade mudou em outra sessão. Atualize os dados e tente novamente.");
        await audit(client, org, actor.id, data.action, { name: data.name, timezone: data.timezone, previousVersion: data.version }, data.unitId);
      } else {
        // Explicit owner-only boundary. Legacy admin cannot elevate to owner.
        if (role !== "owner") throw new DomainError(403, "Somente o proprietário pode gerenciar a empresa e os acessos.");
        if (data.action === "organization.update") {
          const updated = await client.query("UPDATE organizations SET name=$1,version=version+1 WHERE id=$2 AND version=$3 RETURNING id", [data.name, org, data.version]);
          if (!updated.rowCount) throw new DomainError(409, "A empresa mudou em outra sessão. Atualize antes de salvar.");
          await audit(client, org, actor.id, data.action, { name: data.name, previousVersion: data.version });
        } else if (data.action === "unit.create") {
          const prior = await client.query("SELECT name,timezone FROM units WHERE organization_id=$1 AND id=$2", [org, data.unitId]);
          if (prior.rowCount) {
            if (prior.rows[0].name !== data.name || prior.rows[0].timezone !== data.timezone) throw new DomainError(409, "Identificador já utilizado por outra unidade.");
          } else {
            await client.query("INSERT INTO units(id,organization_id,name,timezone) VALUES($1,$2,$3,$4)", [data.unitId, org, data.name, data.timezone]);
            await audit(client, org, actor.id, data.action, { name: data.name, timezone: data.timezone }, data.unitId);
          }
        } else if (data.action === "invitation.create") {
          await validateUnits(client, org, data.unitIds);
          const member = await client.query("SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND lower(u.email)=$2", [org, data.email]);
          if (member.rowCount) throw new DomainError(409, "Este usuário já pertence à empresa. Edite o acesso existente.");
          const token = randomBytes(32).toString("hex");
          await client.query("UPDATE invitations SET revoked_at=now() WHERE organization_id=$1 AND email=$2 AND accepted_at IS NULL AND revoked_at IS NULL", [org, data.email]);
          const invitation = (await client.query("INSERT INTO invitations(organization_id,email,role,token_hash,created_by,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '48 hours') RETURNING id", [org, data.email, data.role, hash(token), actor.id])).rows[0].id;
          for (const id of new Set(data.unitIds)) await client.query("INSERT INTO invitation_units VALUES($1,$2,$3)", [org, invitation, id]);
          await audit(client, org, actor.id, data.action, { invitationId: invitation, role: data.role, unitIds: data.unitIds });
          result = { invitationToken: token };
        } else if (data.action === "invitation.revoke") {
          const changed = await client.query("UPDATE invitations SET revoked_at=COALESCE(revoked_at,now()) WHERE organization_id=$1 AND id=$2 AND accepted_at IS NULL RETURNING id", [org, data.invitationId]);
          if (!changed.rowCount) throw new DomainError(409, "Convite não encontrado ou já aceito.");
          await audit(client, org, actor.id, data.action, { invitationId: data.invitationId });
        } else {
          const target = (await client.query("SELECT role,version FROM memberships WHERE organization_id=$1 AND user_id=$2 FOR UPDATE", [org, data.userId])).rows[0];
          if (!target) throw new DomainError(404, "Membro não encontrado nesta empresa.");
          if (target.version !== data.version) throw new DomainError(409, "O acesso mudou em outra sessão. Atualize antes de salvar.");
          if (target.role === "owner" && (data.action === "member.remove" || data.role !== "owner")) {
            const owners = await client.query("SELECT 1 FROM memberships WHERE organization_id=$1 AND role='owner'", [org]);
            if (owners.rowCount === 1) throw new DomainError(409, "A empresa precisa manter pelo menos um proprietário.");
          }
          if (data.action === "member.remove") {
            await client.query("DELETE FROM memberships WHERE organization_id=$1 AND user_id=$2", [org, data.userId]);
          } else {
            if (data.role !== "owner" && !data.unitIds.length) throw new DomainError(400, "Selecione pelo menos uma unidade.");
            await validateUnits(client, org, data.unitIds);
            await client.query("UPDATE memberships SET role=$1,version=version+1 WHERE organization_id=$2 AND user_id=$3", [data.role, org, data.userId]);
            await client.query("DELETE FROM unit_access WHERE organization_id=$1 AND user_id=$2", [org, data.userId]);
            for (const id of new Set(data.unitIds)) await client.query("INSERT INTO unit_access VALUES($1,$2,$3)", [org, id, data.userId]);
          }
          await audit(client, org, actor.id, data.action, { userId: data.userId, previousRole: target.role, newRole: data.action === "member.update" ? data.role : null, unitIds: data.action === "member.update" ? data.unitIds : [] });
        }
      }
      result.organizationId = org;
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") throw new DomainError(409, "Este identificador ou nome já está em uso. Atualize os dados antes de tentar novamente.");
    throw error;
  } finally { client.release(); }
}
