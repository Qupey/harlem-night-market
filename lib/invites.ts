import "server-only";
import { inviteEmail, sendEmail } from "./email";
import { newInviteToken } from "./payments";
import { updatePayment, type StoredApplication } from "./store";

export type InviteResult = { sent: boolean; invitedAt?: string; error?: string; columnsMissing?: boolean };

// Emails a vendor their payment link and starts their 10-day clock. A resend keeps the original clock.
export async function sendInvite(a: StoredApplication): Promise<InviteResult> {
  const inviteToken = a.inviteToken ?? newInviteToken();
  if (!a.inviteToken) {
    const saved = await updatePayment(a.id, { inviteToken });
    if (saved.columnsMissing) return { sent: false, columnsMissing: true };
  }
  const result = await sendEmail(a.email, inviteEmail({ ...a, inviteToken }));
  if (!result.sent) return { sent: false, error: result.error };
  const invitedAt = a.invitedAt ?? new Date().toISOString();
  await updatePayment(a.id, { invitedAt });
  return { sent: true, invitedAt };
}
