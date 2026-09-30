import { getDb } from "@/server/db";
import { requireActor } from "@/server/session";
import { DomainError } from "@/server/errors";
import { mutateWorkspace, readWorkspace } from "@/server/workspace";
import { z } from "zod";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function failure(error: unknown) {
  if (error instanceof DomainError) return json({ error: error.message }, error.status);
  console.error("workspace_request_failed", { type: error instanceof Error ? error.name : "unknown" });
  return json({ error: "Não foi possível concluir. Tente novamente; se persistir, contate o administrador." }, 500);
}
export async function GET(request: Request) {
  try {
    const actor = await requireActor(request.headers);
    const id = new URL(request.url).searchParams.get("organizationId") ?? undefined;
    if (id && !z.uuid().safeParse(id).success) throw new DomainError(400, "Empresa inválida.");
    return json(await readWorkspace(getDb(), actor, id));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const configured = process.env.BETTER_AUTH_URL;
    if (!configured || request.headers.get("origin") !== new URL(configured).origin) throw new DomainError(403, "Origem da requisição não permitida.");
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new DomainError(415, "Envie JSON.");
    const actor = await requireActor(request.headers);
    // Bound the actual stream, not just the client-supplied Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new DomainError(400, "Dados ausentes.");
    let size = 0; const chunks: Uint8Array[] = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16384) { await reader.cancel(); throw new DomainError(413, "Requisição muito grande."); }
      chunks.push(value);
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new DomainError(400, "Dados inválidos."); }
    return json(await mutateWorkspace(getDb(), actor, body));
  } catch (error) { return failure(error); }
}
