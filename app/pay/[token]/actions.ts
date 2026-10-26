"use server";

import { redirect } from "next/navigation";
import { getEvent } from "@/lib/events";
import { canBeInvited, feePerDateCents, findByInviteToken, siteUrl } from "@/lib/payments";
import { stripe } from "@/lib/stripe";

// Sends the vendor to Stripe Checkout for every market date they're booked for.
// The price comes from the server (fee rules in lib/payments.ts), never from the form.
export async function startCheckoutAction(form: FormData) {
  const token = String(form.get("token") ?? "");
  const app = await findByInviteToken(token);
  const client = stripe();
  if (!app || !canBeInvited(app) || !client) redirect(`/pay/${encodeURIComponent(token)}`);

  const event = getEvent(app.eventSlug);
  const fee = feePerDateCents(app);
  const session = await client.checkout.sessions.create({
    mode: "payment",
    customer_email: app.email,
    client_reference_id: app.id,
    metadata: { application_id: app.id, business: app.businessName.slice(0, 450), dates: (app.assignedDates ?? []).join(",") },
    payment_intent_data: {
      description: `${event?.name ?? "Harlem Night Market"} vendor fee · ${app.businessName}`.slice(0, 1000),
      metadata: { application_id: app.id },
    },
    line_items: (app.assignedDates ?? []).map((d) => ({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: fee,
        product_data: {
          name: `Vendor space · ${event?.dates.find((x) => x.id === d)?.label ?? d}`,
          description: `${app.businessName} · ${app.marketCategory === "Hot Food" ? "Hot food" : "Vendor"} fee`,
        },
      },
    })),
    success_url: `${siteUrl()}/pay/${token}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/pay/${token}/cancelled`,
  });
  redirect(session.url!);
}
