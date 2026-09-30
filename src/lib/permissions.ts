export const roles = ["owner", "manager", "cashier", "attendant", "kitchen", "courier"] as const;
export type Role = typeof roles[number] | "admin" | "member";
export type Permission = "organization:read" | "organization:manage" | "members:manage" | "billing:manage"
  | "units:manage" | "audit:read" | "orders:create" | "orders:discount" | "orders:cancel"
  | "payments:record" | "cash:manage" | "kitchen:work" | "delivery:work";

export const roleLabels: Record<Role, string> = {
  owner: "Proprietário", manager: "Gerente", cashier: "Caixa", attendant: "Atendente",
  kitchen: "Cozinha", courier: "Entregador", admin: "Administrador (legado)", member: "Membro (legado)",
};

const grants: Record<Role, readonly Permission[]> = {
  owner: ["organization:read", "organization:manage", "members:manage", "billing:manage", "units:manage", "audit:read", "orders:create", "orders:discount", "orders:cancel", "payments:record", "cash:manage", "kitchen:work", "delivery:work"],
  manager: ["organization:read", "units:manage", "audit:read", "orders:create", "orders:discount", "orders:cancel", "payments:record", "cash:manage", "kitchen:work", "delivery:work"],
  cashier: ["organization:read", "orders:create", "payments:record", "cash:manage"],
  attendant: ["organization:read", "orders:create"],
  kitchen: ["organization:read", "kitchen:work"],
  courier: ["organization:read", "delivery:work"],
  admin: ["organization:read", "organization:manage", "members:manage"],
  member: ["organization:read"],
};

export function can(role: Role, permission: Permission): boolean {
  return Object.hasOwn(grants, role) && grants[role].includes(permission);
}
