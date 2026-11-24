// Fee checks used by the admin list, the market board (in the browser) and the exports.
// No server-only imports, so the board can use them too.

export const sameDates = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

// An invited, unpaid vendor whose booked dates are no longer the ones their invite listed.
// invitedDates is null for invites sent before supabase/add-invited-dates.sql was run.
export function datesChangedSinceInvite(v: {
  paid?: boolean;
  invitedAt?: string | null;
  invitedDates?: string[] | null;
  assignedDates?: string[];
}): boolean {
  return !v.paid && !!v.invitedAt && Array.isArray(v.invitedDates) && !sameDates(v.invitedDates, v.assignedDates ?? []);
}

// What a paid vendor is owed back after dropping dates: their price per date (after any
// discount) times the dates dropped, never more than they paid, less refunds already recorded.
export function refundOwedCents(v: {
  amountPaidCents: number | null | undefined;
  amountDiscountCents: number | null | undefined;
  refundedCents: number | null | undefined;
  bookedDates: number;
  feePerDateCents: number;
}): number {
  const paid = v.amountPaidCents ?? 0;
  if (paid <= 0 || v.feePerDateCents <= 0) return 0;
  const paidDates = Math.round((paid + (v.amountDiscountCents ?? 0)) / v.feePerDateCents);
  if (paidDates <= v.bookedDates) return 0;
  const owed = Math.min(paid, Math.round((paid * (paidDates - v.bookedDates)) / paidDates));
  return Math.max(0, owed - (v.refundedCents ?? 0));
}

// Stripe Dashboard page for an online payment, where the refund is made.
export const stripePaymentUrl = (paymentId: string | null | undefined) =>
  paymentId?.startsWith("pi_") ? `https://dashboard.stripe.com/payments/${paymentId}` : null;
