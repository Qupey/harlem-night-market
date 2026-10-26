import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { confirmCheckoutSession } from "@/lib/checkout";
import { stripe } from "@/lib/stripe";
import { ContactLine, PayShell } from "../PayShell";

export const metadata = { title: "Payment received | Harlem Night Market", robots: { index: false } };

export default function PaySuccessPage({ params, searchParams }: PageProps<"/pay/[token]/success">) {
  return (
    <PayShell>
      <Suspense fallback={<p className="mt-10 text-center text-muted">Confirming your payment...</p>}>
        <Confirm params={params} searchParams={searchParams} />
      </Suspense>
      <ContactLine />
    </PayShell>
  );
}

async function Confirm({ params, searchParams }: Pick<PageProps<"/pay/[token]/success">, "params" | "searchParams">) {
  await connection();
  const { token } = await params;
  const sessionId = (await searchParams).session_id;
  const client = stripe();

  // Record it now in case Stripe's webhook hasn't arrived yet; recording twice is harmless.
  let confirmed = false;
  if (client && typeof sessionId === "string" && sessionId.startsWith("cs_")) {
    const session = await client.checkout.sessions.retrieve(sessionId).catch(() => null);
    if (session && session.metadata?.application_id) confirmed = await confirmCheckoutSession(session);
  }

  return (
    <section className="mt-10 rounded-2xl border-2 border-teal bg-panel p-6 text-center">
      <h1 className="display text-5xl text-teal">{confirmed ? "Payment received" : "Thank you"}</h1>
      <p className="mt-4 text-cream">
        {confirmed
          ? "Your space is confirmed. A receipt is on its way to your email."
          : "We're confirming your payment. You'll get a receipt by email shortly."}
      </p>
      <Link href={`/pay/${token}`} className="btn-secondary mt-6">
        View my booking
      </Link>
    </section>
  );
}
