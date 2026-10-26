import { connection } from "next/server";
import { Suspense } from "react";
import {
  amountDueCents,
  assignedDateLabels,
  canBeInvited,
  dollars,
  feePerDateCents,
  findByInviteToken,
  REFUND_POLICY,
  stripeConfigured,
} from "@/lib/payments";
import { startCheckoutAction } from "./actions";
import { ContactLine, PayShell } from "./PayShell";

export const metadata = { title: "Vendor fee | Harlem Night Market", robots: { index: false } };

// The private payment page each invited vendor gets by email.
export default function PayPage({ params }: PageProps<"/pay/[token]">) {
  return (
    <PayShell>
      <Suspense fallback={<p className="mt-10 text-center text-muted">Loading...</p>}>
        <PayDetails params={params} />
      </Suspense>
      <ContactLine />
    </PayShell>
  );
}

async function PayDetails({ params }: { params: PageProps<"/pay/[token]">["params"] }) {
  await connection();
  const { token } = await params;
  const app = await findByInviteToken(token);

  if (app?.paid) {
    return (
      <section className="mt-10 rounded-2xl border-2 border-teal bg-panel p-6 text-center">
        <h1 className="display text-5xl text-teal">You&apos;re confirmed</h1>
        <p className="mt-4 text-cream">
          We received your payment{app.amountPaidCents ? ` of ${dollars(app.amountPaidCents)}` : ""} for{" "}
          <strong>{app.businessName}</strong>. Your space is held for:
        </p>
        <ul className="mt-3 space-y-1 font-semibold text-gold">
          {assignedDateLabels(app).map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </section>
    );
  }

  if (!app || !canBeInvited(app)) {
    return (
      <section className="mt-10 rounded-2xl border border-line bg-panel p-6 text-center">
        <h1 className="display text-4xl text-orange">This payment link isn&apos;t active</h1>
        <p className="mt-4 text-cream">
          The link may be out of date, or your booking has changed. Please contact us and we&apos;ll sort it out.
        </p>
      </section>
    );
  }

  const fee = dollars(feePerDateCents(app));
  const total = dollars(amountDueCents(app));
  return (
    <section className="mt-10 rounded-2xl border border-line bg-panel p-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-gold">Vendor fee</p>
      <h1 className="display mt-2 text-5xl text-orange">{app.businessName}</h1>
      <p className="mt-3 text-cream">
        Congratulations, you&apos;ve been invited into the market! Your space is held once your fee is paid.
      </p>
      <table className="mt-6 w-full text-left text-cream">
        <tbody className="divide-y divide-line">
          {assignedDateLabels(app).map((d) => (
            <tr key={d}>
              <td className="py-2">{d}</td>
              <td className="py-2 text-right">{fee}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-orange">
            <td className="pt-3 font-extrabold uppercase tracking-wide">Total</td>
            <td className="pt-3 text-right text-2xl font-extrabold text-orange">{total}</td>
          </tr>
        </tfoot>
      </table>
      {stripeConfigured() ? (
        <form action={startCheckoutAction} className="mt-8">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn-primary w-full justify-center py-3 text-lg">
            Pay {total} securely
          </button>
          <p className="mt-2 text-center text-xs text-muted">Card, Apple Pay or Google Pay, processed by Stripe.</p>
        </form>
      ) : (
        <p className="mt-8 rounded-lg border border-gold bg-gold/10 px-4 py-3 text-sm text-cream">
          Online payment isn&apos;t open yet. Please check back soon or contact us.
        </p>
      )}
      <p className="mt-6 text-sm text-muted">{REFUND_POLICY}</p>
    </section>
  );
}
