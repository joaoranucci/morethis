import { getDb } from "@/server/db";

export async function GET() {
  try {
    await getDb().query("SELECT 1 FROM auth_sessions LIMIT 0");
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
