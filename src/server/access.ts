import "server-only";
import type { Pool, PoolClient } from "pg";
import { can, type Permission, type Role } from "../lib/permissions";
import { DomainError } from "./errors";

export type Database = Pool | PoolClient;
export async function requireAccess(db: Database, userId: string, organizationId: string, permission: Permission, unitId?: string): Promise<Role> {
  const result = await db.query<{ role: Role }>(
    `SELECT m.role FROM memberships m WHERE m.organization_id=$1 AND m.user_id=$2
     AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM units u WHERE u.organization_id=m.organization_id AND u.id=$3
       AND (m.role='owner' OR EXISTS(SELECT 1 FROM unit_access a WHERE a.organization_id=u.organization_id AND a.unit_id=u.id AND a.user_id=m.user_id))))`,
    [organizationId, userId, unitId ?? null],
  );
  const role = result.rows[0]?.role;
  if (!role || !can(role, permission)) throw new DomainError(403, "Você não tem acesso a esta ação ou unidade.");
  return role;
}
