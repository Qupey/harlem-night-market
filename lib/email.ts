import "server-only";
import { getEvent } from "./events";
import {
  amountDueCents,
  assignedDateLabels,
  dollars,
  feePerDateCents,
  OVERDUE_AFTER_DAYS,
  payLink,
  REFUND_POLICY,
} from "./payments";
import type { StoredApplication } from "./store";

// Vendor emails, sent through Resend (https://resend.com) from info@harlemnightmarket.com.
// Without RESEND_API_KEY nothing is sent and callers get { sent: false }.

const FROM = process.env.EMAIL_FROM || "Harlem Night Market <info@harlemnightmarket.com>";

export type EmailResult = { sent: true } | { sent: false; error: string };

type Email = { subject: string; text: string; html: string };

export async function sendEmail(to: string, email: Email): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, error: "Email isn't set up yet (RESEND_API_KEY is missing)." };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: "info@harlemnightmarket.com", ...email }),
  });
  if (res.ok) return { sent: true };
  const detail = await res.text().catch(() => "");
  return { sent: false, error: `Email to ${to} failed (${res.status}) ${detail.slice(0, 200)}` };
}

// --- Templates -------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Builds the plain-text and HTML versions from the same paragraphs. A paragraph can be a button.
function compose(subject: string, parts: (string | { button: string; href: string } | string[])[]): Email {
  const text = parts
    .map((p) => (typeof p === "string" ? p : Array.isArray(p) ? p.map((x) => `  • ${x}`).join("\n") : `${p.button}: ${p.href}`))
    .join("\n\n");
  const body = parts
    .map((p) =>
      typeof p === "string"
        ? `<p style="margin:0 0 16px">${esc(p)}</p>`
        : Array.isArray(p)
          ? `<ul style="margin:0 0 16px;padding-left:20px">${p.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
          : `<p style="margin:24px 0"><a href="${esc(p.href)}" style="background:#f2832a;color:#0e0e52;font-weight:bold;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">${esc(p.button)}</a></p>`,
    )
    .join("");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1d1d1d;max-width:560px">${body}</div>`;
  return { subject, text, html };
}

const signoff = "Harlem Night Market team\ninfo@harlemnightmarket.com";

function feeLines(a: StoredApplication) {
  const each = dollars(feePerDateCents(a));
  return assignedDateLabels(a).map((d) => `${d} · ${each}`);
}

export function inviteEmail(a: StoredApplication): Email {
  const event = getEvent(a.eventSlug);
  const total = dollars(amountDueCents(a));
  return compose(`You're invited to ${event?.name ?? "Harlem Night Market"}! Confirm your space`, [
    `Hi ${a.contactName},`,
    `Congratulations! ${a.businessName} has been invited to vend at ${event?.name ?? "Harlem Night Market"} at ${event?.venue ?? "La Marqueta"}, ${event?.address ?? ""}.`.replace(/, \.$/, "."),
    "Your market date(s):",
    feeLines(a),
    `Your space is not held until your vendor fee of ${total} is paid. Please pay within ${OVERDUE_AFTER_DAYS} days to keep your spot.`,
    { button: `Pay ${total} and confirm my space`, href: payLink(a.inviteToken!) },
    REFUND_POLICY,
    "Questions? Just reply to this email.",
    signoff,
  ]);
}

export function reminderEmail(a: StoredApplication): Email {
  const total = dollars(amountDueCents(a));
  return compose(`Reminder: confirm your Harlem Night Market space`, [
    `Hi ${a.contactName},`,
    `A friendly reminder that the space for ${a.businessName} isn't held until your vendor fee of ${total} is paid.`,
    "Your market date(s):",
    feeLines(a),
    { button: `Pay ${total} and confirm my space`, href: payLink(a.inviteToken!) },
    REFUND_POLICY,
    "If you can no longer take part, just reply and let us know so we can offer the space to another vendor.",
    signoff,
  ]);
}

export function declineEmail(a: StoredApplication): Email {
  const event = getEvent(a.eventSlug);
  return compose(`Your ${event?.name ?? "Harlem Night Market"} application`, [
    `Hi ${a.contactName},`,
    `Thank you for applying to vend at ${event?.name ?? "Harlem Night Market"}. We received many strong applications, and we aren't able to offer ${a.businessName} a space this season.`,
    "We appreciate your interest and hope you'll apply again for future markets.",
    signoff,
  ]);
}

export function receiptEmail(a: StoredApplication, amountCents: number): Email {
  return compose(`Payment received: your Harlem Night Market space is confirmed`, [
    `Hi ${a.contactName},`,
    `We received your payment of ${dollars(amountCents)}. The space for ${a.businessName} is confirmed for:`,
    assignedDateLabels(a),
    "We'll be in touch with load-in times and setup details before the market.",
    REFUND_POLICY,
    signoff,
  ]);
}
