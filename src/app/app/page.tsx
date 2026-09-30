import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireActor } from "@/server/session";
import { DomainError } from "@/server/errors";
import { getDb } from "@/server/db";
import { readWorkspace } from "@/server/workspace";
import { WorkspaceClient } from "./workspace-client";

export default async function AppPage() {
  let actor;
  try { actor = await requireActor(await headers()); }
  catch (error) { if (error instanceof DomainError && error.status === 401) redirect("/entrar"); throw error; }
  const initial = await readWorkspace(getDb(), actor);
  return <WorkspaceClient initial={JSON.parse(JSON.stringify(initial))} />;
}
