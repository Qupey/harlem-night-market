import { sendInvite } from "@/lib/invites";
import { canBeInvited, PAYMENT_STATE_LABELS, paymentState } from "@/lib/payments";
import { listApplications } from "@/lib/store";

// Market board: POST { id } emails a vendor their payment invite, or sends it again.
// The vendor's email address stays on the server, so errors are reworded to leave it out.
// Protected by the admin password check in proxy.ts.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== "string") return Response.json({ error: "Expected { id }" }, { status: 400 });

  const app = (await listApplications()).find((a) => a.id === body.id);
  if (!app) return Response.json({ error: "Vendor not found" }, { status: 404 });
  if (!canBeInvited(app)) {
    return Response.json({ error: "This vendor needs to be accepted, booked on a date and unpaid." }, { status: 409 });
  }

  const result = await sendInvite(app);
  if (result.columnsMissing) {
    return Response.json({ error: "Run supabase/add-payments.sql in the Supabase SQL Editor first." }, { status: 409 });
  }
  if (!result.sent) {
    return Response.json({ error: (result.error ?? "The email didn't send.").replaceAll(app.email, "the vendor") }, { status: 502 });
  }
  const state = paymentState({ ...app, invitedAt: result.invitedAt });
  return Response.json(
    { invitedAt: result.invitedAt, paymentState: state, paymentLabel: PAYMENT_STATE_LABELS[state] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
