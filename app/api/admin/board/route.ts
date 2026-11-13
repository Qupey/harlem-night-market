import { adminOnly } from "@/lib/admin-auth";
import { getEvent } from "@/lib/events";
import { PAYMENT_STATE_LABELS, paymentState } from "@/lib/payments";
import { MARKET_CATEGORIES, STATUS_LABELS } from "@/lib/selection";
import { listApplications, type StoredApplication, updateSelection } from "@/lib/store";

// Market board: POST { id, assignedDates, marketCategory?, status? } books a vendor for market dates
// and can change their status. Sends no emails and leaves payment fields alone.
// Protected by the admin password check in proxy.ts.
export async function POST(request: Request) {
  const denied = adminOnly(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (
    typeof body?.id !== "string" ||
    !Array.isArray(body.assignedDates) ||
    !body.assignedDates.every((d: unknown) => typeof d === "string") ||
    (body.marketCategory !== undefined && typeof body.marketCategory !== "string") ||
    (body.status !== undefined && !Object.keys(STATUS_LABELS).includes(body.status))
  ) {
    return Response.json({ error: "Expected { id, assignedDates, marketCategory?, status? }" }, { status: 400 });
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
  const status: StoredApplication["status"] = body.status ?? app.status;
  const result = await updateSelection(app.id, { status, assignedDates, marketCategory });
  if (result.columnsMissing) {
    return Response.json(
      { error: "Run supabase/add-vendor-selection.sql in the Supabase SQL Editor first." },
      { status: 409 },
    );
  }
  if (!result.ok) return Response.json({ error: "Vendor not found" }, { status: 404 });
  const state = status === "accepted" ? paymentState(app) : null;
  return Response.json(
    { assignedDates, marketCategory, status, paymentState: state, paymentLabel: state && PAYMENT_STATE_LABELS[state] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
