export function GET() {
  return Response.json({ status: "ok", service: "morethis" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
