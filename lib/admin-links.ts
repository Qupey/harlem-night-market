import "server-only";
import { createLinkToken } from "./admin-auth";
import type { AdminUserRow } from "./admin-db";
import { adminLinkEmail, sendEmail } from "./email";
import { siteUrl } from "./payments";

// Emails an admin a link to set their password (when they're invited, or forgot it).
// Without email set up, the link goes to the server log so it can still be tested.
export async function sendSetPasswordLink(user: AdminUserRow, kind: "invite" | "reset"): Promise<boolean> {
  const link = `${siteUrl()}/admin/set-password?token=${await createLinkToken(user.id)}`;
  if (!process.env.RESEND_API_KEY) {
    console.warn(`Email isn't set up, so here is the ${kind} link for ${user.email}: ${link}`);
    return false;
  }
  const result = await sendEmail(user.email, adminLinkEmail(kind, link));
  if (!result.sent) console.error(`Admin ${kind} email failed: ${result.error}`);
  return result.sent;
}
