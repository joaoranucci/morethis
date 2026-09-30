import "server-only";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { DomainError } from "./errors";

export type Actor = { id: string; name: string; email: string };

export async function requireActor(headers: Headers): Promise<Actor> {
  const session = await getAuth().api.getSession({ headers });
  if (!session) throw new DomainError(401, "Sua sessão expirou. Entre novamente.");
  // Link by provider subject only, NEVER adopt an existing business user by email.
  const result = await getDb().query<Actor>(
    `INSERT INTO users(auth_subject,email,name) VALUES($1,$2,$3)
     ON CONFLICT(auth_subject) DO UPDATE SET name=EXCLUDED.name
     RETURNING id,name,email`,
    [`better-auth:${session.user.id}`, session.user.email.toLowerCase(), session.user.name],
  );
  return result.rows[0];
}
