import "server-only";
import { randomBytes } from "node:crypto";
import { getEvent } from "./events";
import { listApplications, updatePayment, type StoredApplication } from "./store";

// Vendor fees: what each accepted vendor owes, where their payment stands, and the
// settings (env vars) the payment and email features need.

export const HOT_FOOD_FEE_CENTS = 5500;
export const STANDARD_FEE_CENTS = 3500;
export const OVERDUE_AFTER_DAYS = 10;
export const REMINDER_AFTER_DAYS = 7;
export const REFUND_POLICY =
  "Fees are per market date. Payments are non-refundable within 14 days of the market date.";

const DAY_MS = 24 * 60 * 60 * 1000;

// Charged per assigned market date; set on the server only, never from the browser.
export const feePerDateCents = (a: StoredApplication) =>
  a.marketCategory === "Hot Food" ? HOT_FOOD_FEE_CENTS : STANDARD_FEE_CENTS;

export const amountDueCents = (a: StoredApplication) => feePerDateCents(a) * (a.assignedDates ?? []).length;

export const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

export type PaymentState = "not-invited" | "invited" | "overdue" | "paid";

export function paymentState(a: StoredApplication, now = Date.now()): PaymentState {
  if (a.paid) return "paid";
  if (!a.invitedAt) return "not-invited";
  return now - Date.parse(a.invitedAt) >= OVERDUE_AFTER_DAYS * DAY_MS ? "overdue" : "invited";
}

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  "not-invited": "Invite not sent",
  invited: "Invited · unpaid",
  overdue: "Overdue",
  paid: "Paid",
};

// Accepted, booked for at least one date and not paid yet: can be invited / can pay.
export const canBeInvited = (a: StoredApplication) =>
  a.status === "accepted" && (a.assignedDates ?? []).length > 0 && !a.paid;

export const reminderDue = (a: StoredApplication, now = Date.now()) =>
  canBeInvited(a) && !!a.invitedAt && !a.reminderSentAt && now - Date.parse(a.invitedAt) >= REMINDER_AFTER_DAYS * DAY_MS;

export const newInviteToken = () => randomBytes(24).toString("base64url");

export const assignedDateLabels = (a: StoredApplication) => {
  const event = getEvent(a.eventSlug);
  return (a.assignedDates ?? []).map((d) => event?.dates.find((x) => x.id === d)?.label ?? d);
};

// --- Settings --------------------------------------------------------------

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;
export const stripeWebhookConfigured = () => !!process.env.STRIPE_WEBHOOK_SECRET;
export const emailConfigured = () => !!process.env.RESEND_API_KEY;

export const siteUrl = () =>
  (process.env.SITE_URL || "https://www.harlemnightmarket.com").replace(/\/+$/, "");

export const payLink = (token: string) => `${siteUrl()}/pay/${token}`;

// Names of the settings still missing, for the notice on the admin pages.
export function missingSettings(): string[] {
  return [
    !process.env.STRIPE_SECRET_KEY && "STRIPE_SECRET_KEY",
    !process.env.STRIPE_WEBHOOK_SECRET && "STRIPE_WEBHOOK_SECRET",
    !process.env.RESEND_API_KEY && "RESEND_API_KEY",
    !process.env.SITE_URL && "SITE_URL",
  ].filter((x): x is string => !!x);
}

// --- Recording a payment ---------------------------------------------------

export async function findByInviteToken(token: string): Promise<StoredApplication | undefined> {
  if (!/^[\w-]{20,}$/.test(token)) return undefined;
  return (await listApplications()).find((a) => a.inviteToken === token);
}

// Marks a vendor paid. Safe to call more than once for the same payment (the Stripe webhook
// and the success page can both report it). Returns true only the first time.
export async function recordPayment(
  a: StoredApplication,
  p: { amountCents: number; paymentId: string; method: string },
): Promise<boolean> {
  if (a.paid) return false;
  const result = await updatePayment(a.id, {
    paid: true,
    amountPaidCents: p.amountCents,
    paidAt: new Date().toISOString(),
    paymentId: p.paymentId,
    paymentMethod: p.method,
  });
  return result.ok;
}
