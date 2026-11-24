import "server-only";
import { inviteEmail, sendEmail } from "./email";
import { newInviteToken } from "./payments";
import { updatePayment, type StoredApplication } from "./store";

export type InviteResult = { sent: boolean; invitedAt?: string; error?: string; columnsMissing?: boolean };

// Emails a vendor their payment link and starts their 10-day clock. A resend keeps the original
// clock; an updated invite (their dates changed) says so at the top and restarts it.
export async function sendInvite(a: StoredApplication, opts: { updated?: boolean } = {}): Promise<InviteResult> {
  const inviteToken = a.inviteToken ?? newInviteToken();
  if (!a.inviteToken) {
    const saved = await updatePayment(a.id, { inviteToken });
    if (saved.columnsMissing) return { sent: false, columnsMissing: true };
  }
  const result = await sendEmail(a.email, inviteEmail({ ...a, inviteToken }, opts));
  if (!result.sent) return { sent: false, error: result.error };
  const invitedAt = opts.updated || !a.invitedAt ? new Date().toISOString() : a.invitedAt;
  await updatePayment(a.id, opts.updated ? { invitedAt, reminderSentAt: null } : { invitedAt });
  // Saved separately: until supabase/add-invited-dates.sql has been run this one is skipped.
  await updatePayment(a.id, { invitedDates: a.assignedDates ?? [] });
  return { sent: true, invitedAt };
}
