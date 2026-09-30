import "server-only";
import { betterAuth } from "better-auth";
import { getDb } from "./db";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || secret.startsWith("replace-")) throw new Error("Configure BETTER_AUTH_SECRET com um segredo aleatório de pelo menos 32 caracteres.");
  if (!baseURL) throw new Error("Configure BETTER_AUTH_URL.");
  return betterAuth({
    appName: "Morethis",
    baseURL,
    secret,
    database: getDb(),
    trustedOrigins: [new URL(baseURL).origin],
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
    user: { modelName: "auth_users", changeEmail: { enabled: false }, deleteUser: { enabled: false } },
    session: { modelName: "auth_sessions", expiresIn: 60 * 60 * 12, updateAge: 60 * 30, cookieCache: { enabled: false } },
    account: { modelName: "auth_accounts", accountLinking: { enabled: false } },
    verification: { modelName: "auth_verifications" },
    rateLimit: { enabled: true, storage: "database", modelName: "auth_rate_limits", window: 60, max: 60,
      customRules: { "/sign-in/email": { window: 60, max: 10 }, "/sign-up/email": { window: 60, max: 5 } } },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
