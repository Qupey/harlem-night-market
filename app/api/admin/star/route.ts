import { setStarred } from "@/lib/store";

// Star or unstar a vendor: POST { id, starred }. Protected by the admin password check in proxy.ts.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== "string" || typeof body?.starred !== "boolean") {
    return Response.json({ error: "Expected { id, starred }" }, { status: 400 });
  }
  const result = await setStarred(body.id, body.starred);
  if (result.columnsMissing) {
    return Response.json(
      { error: "Run supabase/add-vendor-star.sql in the Supabase SQL Editor first." },
      { status: 409 },
    );
  }
  if (!result.ok) return Response.json({ error: "Vendor not found" }, { status: 404 });
  return Response.json({ starred: body.starred }, { headers: { "Cache-Control": "no-store" } });
}
