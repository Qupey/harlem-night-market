import "server-only";
import type Stripe from "stripe";
import { receiptEmail, sendEmail } from "./email";
import { recordPayment } from "./payments";
import { listApplications } from "./store";

// Records a finished Stripe Checkout payment against the vendor it was for. Used by the
// webhook and by the success page (whichever arrives first); later calls do nothing.
export async function confirmCheckoutSession(session: Stripe.Checkout.Session): Promise<boolean> {
  if (session.payment_status !== "paid") return false;
  const id = session.metadata?.application_id ?? session.client_reference_id;
  const app = id ? (await listApplications()).find((a) => a.id === id) : undefined;
  if (!app) return false;

  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const amountCents = session.amount_total ?? 0;
  const first = await recordPayment(app, { amountCents, paymentId: paymentIntent ?? session.id, method: "stripe" });
  if (first) await sendEmail(app.email, receiptEmail(app, amountCents));
  return true;
}
