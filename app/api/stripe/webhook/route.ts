import type Stripe from "stripe";
import { confirmCheckoutSession } from "@/lib/checkout";
import { stripe } from "@/lib/stripe";

// Stripe calls this when a vendor's payment completes. Public (not behind the admin
// password); every request is checked against STRIPE_WEBHOOK_SECRET instead.
export async function POST(request: Request) {
  const client = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!client || !secret) return new Response("Stripe is not configured", { status: 503 });

  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await confirmCheckoutSession(event.data.object);
  }
  return Response.json({ received: true });
}
