"use server";

import { adminForAction, audit, looksLikeEmail } from "@/lib/admin-auth";
import { describeAudience, parseAudience, recipientsFor } from "@/lib/broadcast";
import { broadcastEmail, sendEmail, sendEmailBatch } from "@/lib/email";
import { listApplications } from "@/lib/store";

export type BroadcastResult =
  | { kind: "idle" }
  | { kind: "error"; text: string }
  | { kind: "preview"; subject: string; html: string }
  | { kind: "test"; ok: boolean; text: string }
  | { kind: "sent"; sent: number; failed: string[] };

// Preview, test and send for /admin/broadcast (the button pressed is in "intent"). The
// recipients are worked out again here from the audience, so the browser can only leave people out.
export async function broadcastAction(_prev: BroadcastResult, form: FormData): Promise<BroadcastResult> {
  const admin = await adminForAction();
  const intent = form.get("intent");
  const subject = String(form.get("subject") ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200); // one line only
  const body = String(form.get("body") ?? "").trim().slice(0, 10000);
  if (!subject || !body) return { kind: "error", text: "Write a subject and a message first." };

  const audience = parseAudience((key) => form.get(key) as string | null);
  const excluded = new Set(form.getAll("exclude").map(String));
  const recipients = recipientsFor(await listApplications(), audience).filter((a) => !excluded.has(a.id));
  const sample = recipients[0] ?? { contactName: "Jordan", businessName: "Sample Candle Co." };

  if (intent === "preview") {
    const email = broadcastEmail(sample, subject, body);
    return { kind: "preview", subject: email.subject, html: email.html };
  }

  if (intent === "test") {
    const to = String(form.get("testTo") ?? "").trim().slice(0, 254);
    if (!looksLikeEmail(to)) return { kind: "error", text: "Enter the address to send the test to." };
    const email = broadcastEmail(sample, subject, body);
    const result = await sendEmail(to, { ...email, subject: `[TEST] ${email.subject}` });
    return result.sent ? { kind: "test", ok: true, text: `Test sent to ${to}.` } : { kind: "test", ok: false, text: result.error };
  }

  if (intent !== "send") return { kind: "error", text: "Unknown action." };
  if (!process.env.RESEND_API_KEY) return { kind: "error", text: "Email isn't set up yet (RESEND_API_KEY is missing)." };
  if (recipients.length === 0) return { kind: "error", text: "No vendors match this audience." };
  if (Number(form.get("expected")) !== recipients.length) {
    return { kind: "error", text: "The list of vendors changed since this page loaded. Reload the page, check the list and try again." };
  }

  const { sent, failed } = await sendEmailBatch(recipients.map((a) => ({ to: a.email, email: broadcastEmail(a, subject, body) })));
  const failedNames = recipients.filter((a) => failed.includes(a.email)).map((a) => a.businessName);
  await audit(
    admin,
    "Sent a message to vendors",
    `"${subject}" to ${sent.length} (${describeAudience(audience)})${failed.length ? `; ${failed.length} failed` : ""}`,
  );
  return { kind: "sent", sent: sent.length, failed: failedNames };
}
