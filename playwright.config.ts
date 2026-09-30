import { defineConfig } from "@playwright/test";

if (!process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("/morethis_test")) throw new Error("Execute npm run test:setup. Os testes de navegador exigem o banco morethis_test.");
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3100", browserName: "chromium", channel: process.platform === "win32" ? "msedge" : undefined, trace: "off", screenshot: "off" },
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/api/ready",
    reuseExistingServer: false,
    timeout: 120000,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL, BETTER_AUTH_URL: "http://127.0.0.1:3100", BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "" },
  },
});
