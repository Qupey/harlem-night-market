import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

// Null until STRIPE_SECRET_KEY is set (test key sk_test_..., later the live sk_live_... key).
export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}
