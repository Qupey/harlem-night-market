import { getEvent } from "@/lib/events";
import { MARKET_CATEGORIES } from "@/lib/selection";
import { listApplications, updateSelection } from "@/lib/store";

// Market board: POST { id, assignedDates, marketCategory? } books a vendor for market dates.
// Keeps the vendor's status, sends no emails and leaves payment fields alone.
// Protected by the admin password check in proxy.ts.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    typeof body?.id !== "string" ||
    !Array.isArray(body.assignedDates) ||
    !body.assignedDates.every((d: unknown) => typeof d === "string") ||
    (body.marketCategory !== undefined && typeof body.marketCategory !== "string")
  ) {
    return Response.json({ error: "Expected { id, assignedDates, marketCategory? }" }, { status: 400 });
  }

  const app = (await listApplications()).find((a) => a.id === body.id);
  if (!app) return Response.json({ error: "Vendor not found" }, { status: 404 });

  const validDates = getEvent(app.eventSlug)?.dates.map((d) => d.id) ?? [];
  const dates = body.assignedDates as string[];
  const bad = dates.find((d) => !validDates.includes(d));
  if (bad) return Response.json({ error: `${bad} isn't a market date for this vendor's event` }, { status: 400 });
  if (body.marketCategory && !(MARKET_CATEGORIES as readonly string[]).includes(body.marketCategory)) {
    return Response.json({ error: "Unknown market category" }, { status: 400 });
  }

  const assignedDates = validDates.filter((d) => dates.includes(d));
  const marketCategory = body.marketCategory ?? app.marketCategory ?? "";
  const result = await updateSelection(app.id, { status: app.status, assignedDates, marketCategory });
  if (result.columnsMissing) {
    return Response.json(
      { error: "Run supabase/add-vendor-selection.sql in the Supabase SQL Editor first." },
      { status: 409 },
    );
  }
  if (!result.ok) return Response.json({ error: "Vendor not found" }, { status: 404 });
  return Response.json({ assignedDates, marketCategory }, { headers: { "Cache-Control": "no-store" } });
}
