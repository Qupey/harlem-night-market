import Link from "next/link";
import { Suspense } from "react";
import { ContactLine, PayShell } from "../PayShell";

export const metadata = { title: "Payment cancelled | Harlem Night Market", robots: { index: false } };

export default function PayCancelledPage({ params }: PageProps<"/pay/[token]/cancelled">) {
  return (
    <PayShell>
      <section className="mt-10 rounded-2xl border border-line bg-panel p-6 text-center">
        <h1 className="display text-5xl text-orange">Payment not completed</h1>
        <p className="mt-4 text-cream">
          No charge was made. Your space isn&apos;t held until the fee is paid, so please try again when you&apos;re
          ready.
        </p>
        <Suspense>
          {params.then(({ token }) => (
            <Link href={`/pay/${token}`} className="btn-primary mt-6">
              Back to payment
            </Link>
          ))}
        </Suspense>
      </section>
      <ContactLine />
    </PayShell>
  );
}
