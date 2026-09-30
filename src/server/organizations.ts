import "server-only";
import type { Pool } from "pg";
import { can, type Permission, type Role } from "../lib/permissions";

type Organization = { id: string; name: string; slug: string; role: Role };

/** userId MUST come from a verified server-side session, never a request body/header. */
export async function requireOrganization(
  db: Pool,
  userId: string,
  organizationId: string,
  permission: Permission = "organization:read",
): Promise<Organization> {
  const result = await db.query<Organization>(
    `SELECT o.id, o.name, o.slug, m.role
       FROM organizations o
       JOIN memberships m ON m.organization_id = o.id
      WHERE o.id = $1 AND m.user_id = $2`,
    [organizationId, userId],
  );
  const organization = result.rows[0];
  if (!organization || !can(organization.role, permission)) {
    throw new Error("FORBIDDEN");
  }
  return organization;
}
