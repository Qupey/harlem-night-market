import { adminOnly } from "@/lib/admin-auth";
import { events } from "@/lib/events";
import { setCapacity } from "@/lib/store";

const ALL_DATES = events.flatMap((e) => e.dates.map((d) => d.id));

// Market size: POST { date, capacity } where capacity is a whole number above 0, or null for no limit.
// Protected by the admin password check in proxy.ts.
export async function POST(request: Request) {
  const denied = adminOnly(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const capacity = body?.capacity;
  if (
    !ALL_DATES.includes(body?.date) ||
    !(capacity === null || (Number.isInteger(capacity) && capacity > 0 && capacity <= 10000))
  ) {
    return Response.json({ error: "Expected { date, capacity } with capacity a whole number above 0, or null" }, {
      status: 400,
    });
  }
  const result = await setCapacity(body.date, capacity);
  if (result.columnsMissing) {
    return Response.json(
      { error: "Run supabase/add-market-capacity.sql to save market sizes", tableMissing: true },
      { status: 409 },
    );
  }
  return Response.json({ capacity }, { headers: { "Cache-Control": "no-store" } });
}
