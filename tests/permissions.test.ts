import { describe, expect, it } from "vitest";
import { can, type Role } from "../src/lib/permissions";

describe("permissões", () => {
  it("permite leitura aos três perfis", () => {
    for (const role of ["owner", "admin", "member"] as const) expect(can(role, "organization:read")).toBe(true);
  });
  it("restringe administração e cobrança", () => {
    expect(can("member", "members:manage")).toBe(false);
    expect(can("member", "organization:manage")).toBe(false);
    expect(can("admin", "members:manage")).toBe(true);
    expect(can("admin", "billing:manage")).toBe(false);
    expect(can("owner", "billing:manage")).toBe(true);
  });
  it("nega um perfil desconhecido", () => {
    expect(can("unknown" as Role, "organization:read")).toBe(false);
    expect(can("constructor" as Role, "organization:read")).toBe(false);
  });
  it("separa cozinha, entrega, caixa e atendimento", () => {
    expect(can("kitchen", "kitchen:work")).toBe(true);
    expect(can("kitchen", "payments:record")).toBe(false);
    expect(can("courier", "delivery:work")).toBe(true);
    expect(can("courier", "audit:read")).toBe(false);
    expect(can("attendant", "orders:create")).toBe(true);
    expect(can("attendant", "orders:discount")).toBe(false);
    expect(can("cashier", "payments:record")).toBe(true);
    expect(can("cashier", "members:manage")).toBe(false);
    expect(can("manager", "orders:discount")).toBe(true);
    expect(can("manager", "members:manage")).toBe(false);
  });
});
