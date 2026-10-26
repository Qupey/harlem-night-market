import {
  amountDueCents,
  canBeInvited,
  dollars,
  emailConfigured,
  feePerDateCents,
  missingSettings,
  payLink,
  paymentState,
  PAYMENT_STATE_LABELS,
  type PaymentState,
} from "@/lib/payments";
import type { StoredApplication } from "@/lib/store";
import {
  createPayLinkAction,
  markPaidAction,
  markUnpaidAction,
  sendDeclineEmailAction,
  sendInvitesAction,
  sendReminderAction,
} from "./actions";

// Vendor fee pieces of the admin: the badge on each row, the fee panel inside an expanded card,
// the setup notice and the totals tile.

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });

// Shown for vendors that are (or were) in the payment flow. Navy pill so it reads on the teal booked row too.
export function PaymentBadge({ app }: { app: StoredApplication }) {
  if (!app.paid && !app.invitedAt && app.status !== "accepted") return null;
  const state = paymentState(app);
  const tone: Record<PaymentState, string> = {
    "not-invited": "text-cream",
    invited: "text-gold",
    overdue: "bg-pink! text-cream",
    paid: "text-teal",
  };
  return (
    <span
      className={`pay-badge ml-1.5 rounded-md bg-navy-deep px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide ${tone[state]}`}
    >
      {state === "paid" && `✓ Paid${app.amountPaidCents ? ` ${dollars(app.amountPaidCents)}` : ""}`}
      {state === "overdue" && "⚠ Overdue · unpaid"}
      {state === "invited" && PAYMENT_STATE_LABELS.invited}
      {state === "not-invited" && PAYMENT_STATE_LABELS["not-invited"]}
    </span>
  );
}

// Tick box on the row for "Send invites to selected" (vendors ready for a first invite).
export function InviteCheckbox({ app }: { app: StoredApplication }) {
  if (!canBeInvited(app) || app.invitedAt) return null;
  return (
    <input
      type="checkbox"
      name="ids"
      value={app.id}
      form="bulk-invite"
      aria-label={`Select ${app.businessName} for invite`}
      title="Select for invite"
      className="mt-1.5 h-4 w-4 shrink-0 accent-orange"
    />
  );
}

type FormProps = { app: StoredApplication; back: string; returnTo: string; anchor: string };

function Hidden({ app, back, returnTo, anchor }: FormProps) {
  return (
    <>
      <input type="hidden" name="id" value={app.id} />
      <input type="hidden" name="ids" value={app.id} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="anchor" value={anchor} />
    </>
  );
}

export function PaymentPanel(props: FormProps) {
  const { app: a } = props;
  const dates = a.assignedDates ?? [];
  const email = emailConfigured();
  const noEmail = email ? undefined : "Email isn't set up yet (RESEND_API_KEY)";
  const btn = "btn-secondary px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40";

  if (a.status === "rejected") {
    return (
      <section className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 text-sm">
        <span className="field-label m-0">Decline email</span>
        <span className="text-cream">
          {a.declineEmailedAt ? `Sent ${when(a.declineEmailedAt)}` : "Not sent"}
        </span>
        <form action={sendDeclineEmailAction}>
          <Hidden {...props} />
          <button type="submit" className={btn} disabled={!email} title={noEmail}>
            {a.declineEmailedAt ? "Send again" : "Send decline email"}
          </button>
        </form>
      </section>
    );
  }

  if (a.status !== "accepted" && !a.paid) return null;

  const state = paymentState(a);
  const fee = dollars(feePerDateCents(a));
  return (
    <section className="space-y-3 border-t border-line px-4 py-4 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="field-label m-0">Vendor fee</span>
        <span className="text-cream">
          {dates.length === 0
            ? "Assign market dates to set the fee."
            : `${fee} × ${dates.length} date${dates.length === 1 ? "" : "s"} = `}
          {dates.length > 0 && <strong className="text-orange">{dollars(amountDueCents(a))}</strong>}
          {a.marketCategory === "Hot Food" && <span className="text-muted"> (hot food rate)</span>}
        </span>
        <PaymentBadge app={a} />
      </div>

      <ul className="space-y-0.5 text-muted">
        {a.invitedAt && <li>Invite sent {when(a.invitedAt)}</li>}
        {a.reminderSentAt && <li>Reminder sent {when(a.reminderSentAt)}</li>}
        {a.paid && (
          <li className="text-cream">
            Paid {a.amountPaidCents ? dollars(a.amountPaidCents) : ""}
            {a.paidAt && ` on ${when(a.paidAt)}`} · {a.paymentMethod === "stripe" ? "online (Stripe)" : a.paymentMethod}
            {a.paid && a.amountPaidCents != null && a.amountPaidCents < amountDueCents(a) && (
              <span className="text-pink"> · dates added since: {dollars(amountDueCents(a) - a.amountPaidCents)} more due</span>
            )}
          </li>
        )}
        {a.inviteToken && !a.paid && (
          <li>
            Payment link:{" "}
            <a className="break-all underline" href={payLink(a.inviteToken)} target="_blank" rel="noreferrer">
              {payLink(a.inviteToken)}
            </a>
          </li>
        )}
      </ul>

      <div className="flex flex-wrap items-end gap-3">
        {canBeInvited(a) && !a.invitedAt && (
          <form action={sendInvitesAction}>
            <Hidden {...props} />
            <button type="submit" className="btn-primary px-4 py-1.5 text-sm disabled:opacity-40" disabled={!email} title={noEmail}>
              Send invite
            </button>
          </form>
        )}
        {canBeInvited(a) && !a.inviteToken && (
          <form action={createPayLinkAction}>
            <Hidden {...props} />
            <button type="submit" className={btn} title="Makes the payment link without sending an email">
              Create payment link
            </button>
          </form>
        )}
        {canBeInvited(a) && a.invitedAt && (
          <form action={sendReminderAction}>
            <Hidden {...props} />
            <button type="submit" className={btn} disabled={!email} title={noEmail}>
              {state === "overdue" ? "Send reminder (overdue)" : "Resend reminder"}
            </button>
          </form>
        )}
        {!a.paid && dates.length > 0 && (
          <form action={markPaidAction} className="flex flex-wrap items-end gap-2">
            <Hidden {...props} />
            <label className="block">
              <span className="field-label">Paid outside Stripe</span>
              <select name="method" defaultValue="cash" className="field-input py-1.5">
                <option value="cash">Cash</option>
                <option value="zelle">Zelle</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block">
              <span className="field-label">Amount</span>
              <input
                name="amount"
                inputMode="decimal"
                defaultValue={(amountDueCents(a) / 100).toString()}
                className="field-input w-24 py-1.5"
              />
            </label>
            <button type="submit" className={btn}>
              Mark paid
            </button>
          </form>
        )}
        {a.paid && (
          <form action={markUnpaidAction}>
            <Hidden {...props} />
            <button type="submit" className="text-xs text-muted underline">
              Undo paid (mistake)
            </button>
          </form>
        )}
      </div>
      {state === "overdue" && (
        <p className="text-pink">
          More than 10 days since the invite and still unpaid. Release the space by setting them back to Pending, or
          send a reminder.
        </p>
      )}
    </section>
  );
}

// Bar above a vendor list: sends invites to every ticked row in one go.
export function BulkInviteBar({ back, returnTo }: { back: string; returnTo: string }) {
  return (
    <form
      id="bulk-invite"
      action={sendInvitesAction}
      className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-2 text-sm"
    >
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <span className="text-muted">Tick accepted vendors on the left of their rows, then</span>
      <button
        type="submit"
        className="btn-primary px-4 py-1.5 text-sm disabled:opacity-40"
        disabled={!emailConfigured()}
        title={emailConfigured() ? undefined : "Email isn't set up yet (RESEND_API_KEY)"}
      >
        Send invites to selected
      </button>
    </form>
  );
}

export function PaymentsSetupNotice() {
  const missing = missingSettings();
  if (missing.length === 0) return null;
  return (
    <p className="mt-6 rounded-lg border border-gold bg-gold/10 px-4 py-3 text-sm text-cream">
      <strong className="text-gold">Payments setup not finished.</strong> Missing settings on the host:{" "}
      {missing.join(", ")}. Until then, buttons that need them are turned off; nothing is charged or emailed.
    </p>
  );
}

export function FeesTile({ apps }: { apps: StoredApplication[] }) {
  const accepted = apps.filter((a) => a.status === "accepted" || a.paid);
  const paid = accepted.filter((a) => a.paid);
  const collected = paid.reduce((sum, a) => sum + (a.amountPaidCents ?? 0), 0);
  const unpaid = accepted.filter((a) => !a.paid && (a.assignedDates ?? []).length > 0);
  const overdue = unpaid.filter((a) => paymentState(a) === "overdue").length;
  const outstanding = unpaid.reduce((sum, a) => sum + amountDueCents(a), 0);
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Vendor fees</p>
      <p className="display mt-1 text-4xl text-teal">{dollars(collected)}</p>
      <ul className="mt-1 space-y-0.5 text-sm">
        <li className="flex justify-between gap-4">
          <span className="text-cream">Paid</span>
          <span className="font-semibold text-teal">{paid.length}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span className="text-cream">Unpaid ({dollars(outstanding)})</span>
          <span className="font-semibold text-gold">{unpaid.length}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span className="text-cream">Overdue</span>
          <span className={`font-semibold ${overdue ? "text-pink" : "text-muted"}`}>{overdue}</span>
        </li>
      </ul>
    </div>
  );
}

// Payment filter shared by both admin lists.
export const PAYMENT_FILTERS = [
  ["", "Any payment"],
  ["paid", "Paid"],
  ["unpaid", "Unpaid (invited)"],
  ["overdue", "Overdue"],
  ["not-invited", "Invite not sent"],
] as const;

export function matchesPaymentFilter(a: StoredApplication, filter: string): boolean {
  if (!filter) return true;
  const state = paymentState(a);
  if (filter === "unpaid") return state === "invited" || state === "overdue";
  if (filter === "not-invited") return state === "not-invited" && a.status === "accepted";
  return state === filter;
}
