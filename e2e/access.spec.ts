import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { Pool } from "pg";

const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const suffix = randomUUID();
const email = `owner-${suffix}@example.test`;
const password = `Test-${randomUUID()}!`;
const staffEmail = `kitchen-${suffix}@example.test`;
const staffPassword = `Test-${randomUUID()}!`;
const origin = "http://127.0.0.1:3100";
test.afterAll(async () => {
  const emails = [email, staffEmail];
  try {
    await db.query("DELETE FROM invitations WHERE organization_id IN(SELECT id FROM organizations WHERE created_by IN(SELECT id FROM users WHERE email=ANY($1::text[])))", [emails]);
    await db.query("DELETE FROM audit_events WHERE organization_id IN(SELECT id FROM organizations WHERE created_by IN(SELECT id FROM users WHERE email=ANY($1::text[])))", [emails]);
    await db.query("DELETE FROM organizations WHERE created_by IN(SELECT id FROM users WHERE email=ANY($1::text[]))", [emails]);
    await db.query("DELETE FROM users WHERE email=ANY($1::text[])", [emails]);
    await db.query("DELETE FROM auth_users WHERE email=ANY($1::text[])", [emails]);
  } finally { await db.end(); }
});

test("cadastro → empresa → unidade → convite → restrição de cozinha → logout", async ({ page, browser }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/entrar$/);
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
  await page.getByRole("button", { name: "Criar uma conta" }).click();
  await page.getByLabel("Seu nome").fill("Proprietário teste");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByLabel("Nome da empresa", { exact: true }).fill("Pastelaria de teste");
  await page.getByLabel("Identificador da empresa").fill(`pastelaria-${suffix}`);
  await page.getByRole("button", { name: "Criar empresa", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Empresa e primeira unidade criadas");
  let workspace = await (await page.request.get("/api/workspace")).json();
  const organizationId = workspace.selectedId;
  const unitId = workspace.units[0].id;
  const secondUnit = randomUUID();
  const post = (data: object) => page.request.post("/api/workspace", { headers: { origin }, data });
  expect((await page.request.post("/api/workspace", { headers: { origin: "https://untrusted.example" }, data: { action: "unit.create" } })).status()).toBe(403);
  expect((await post({ action: "unit.create", organizationId, unitId: secondUnit, name: "Filial", timezone: "America/Manaus" })).ok()).toBe(true);
  const invitationResponse = await post({ action: "invitation.create", organizationId, email: staffEmail, role: "kitchen", unitIds: [unitId] });
  expect(invitationResponse.ok()).toBe(true);
  const { invitationToken } = await invitationResponse.json();
  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await staffPage.goto(`/convite#${invitationToken}`);
  await staffPage.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(staffPage).toHaveURL(/\/entrar$/);
  await staffPage.getByRole("button", { name: "Criar uma conta" }).click();
  await staffPage.getByLabel("Seu nome").fill("Cozinha teste");
  await staffPage.getByLabel("E-mail", { exact: true }).fill(staffEmail);
  await staffPage.getByLabel("Senha", { exact: true }).fill(staffPassword);
  await staffPage.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(staffPage).toHaveURL(/\/convite/);
  await staffPage.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(staffPage.getByRole("heading", { name: "Acesso da cozinha" })).toBeVisible();
  await staffPage.setViewportSize({ width: 390, height: 844 });
  await staffPage.screenshot({ path: "test-results/kitchen-mobile.png", fullPage: true });
  await expect(staffPage.getByRole("heading", { name: "Equipe e permissões" })).toHaveCount(0);
  const staffView = await (await staffPage.request.get("/api/workspace")).json();
  expect(staffView.units).toHaveLength(1);
  expect(staffView.units[0].id).toBe(unitId);
  expect(staffView.members).toEqual([]);
  expect((await staffPage.request.post("/api/workspace", { headers: { origin }, data: { action: "unit.update", organizationId, unitId: secondUnit, name: "Ataque", timezone: "UTC", version: 1 } })).status()).toBe(403);
  await staffPage.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(staffPage).toHaveURL(/\/entrar$/);
  expect((await staffPage.request.get("/api/workspace")).status()).toBe(401);
  await staffContext.close();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Equipe e permissões" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/owner-desktop.png", fullPage: true });
  workspace = await (await page.request.get("/api/workspace")).json();
  expect(workspace.members).toHaveLength(2);
  expect(workspace.audit.some((a: { action: string }) => a.action === "invitation.accept")).toBe(true);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText("Não foi possível entrar");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sua operação começa aqui." })).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name.includes("session_token") && cookie.httpOnly && cookie.sameSite !== "None")).toBe(true);
  await db.query('UPDATE auth_sessions SET "expiresAt"=now()-interval \'1 minute\' WHERE "userId" IN(SELECT id FROM auth_users WHERE email=$1)', [email]);
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
  let limited = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await page.request.post("/api/auth/sign-in/email", { headers: { origin }, data: { email, password: "incorrect-password" } });
    if (response.status() === 429) { limited = true; break; }
  }
  expect(limited).toBe(true);
});
