import { z } from "zod";

const uuid = z.uuid();
const name = z.string().trim().min(2, "Informe pelo menos 2 caracteres.").max(100);
const timezone = z.string().max(80).refine((value) => {
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: value }); return true; } catch { return false; }
}, "Fuso horário inválido. Use um identificador IANA, como America/Sao_Paulo.");
const staffRole = z.enum(["manager", "cashier", "attendant", "kitchen", "courier"]);
export const workspaceAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("onboard"), requestId: uuid, name, slug: z.string().min(2).max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), unitName: name, timezone }),
  z.object({ action: z.literal("unit.create"), organizationId: uuid, unitId: uuid, name, timezone }),
  z.object({ action: z.literal("unit.update"), organizationId: uuid, unitId: uuid, name, timezone, version: z.number().int().positive() }),
  z.object({ action: z.literal("organization.update"), organizationId: uuid, name, version: z.number().int().positive() }),
  z.object({ action: z.literal("invitation.create"), organizationId: uuid, email: z.email().max(254).transform((v) => v.toLowerCase()), role: staffRole, unitIds: z.array(uuid).min(1).max(100) }),
  z.object({ action: z.literal("invitation.revoke"), organizationId: uuid, invitationId: uuid }),
  z.object({ action: z.literal("invitation.accept"), token: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.object({ action: z.literal("member.update"), organizationId: uuid, userId: uuid, role: z.enum(["owner", "manager", "cashier", "attendant", "kitchen", "courier"]), unitIds: z.array(uuid).max(100), version: z.number().int().positive() }),
  z.object({ action: z.literal("member.remove"), organizationId: uuid, userId: uuid, version: z.number().int().positive() }),
]);
