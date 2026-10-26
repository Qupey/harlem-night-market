import { declineEmail, inviteEmail, receiptEmail, reminderEmail } from "@/lib/email";
import { amountDueCents } from "@/lib/payments";
import type { StoredApplication } from "@/lib/store";

// Shows what vendors receive: /api/admin/email-preview?type=invite|reminder|decline|receipt
// Uses a made-up vendor, so nothing is sent. Protected by the admin password check in proxy.ts.
const SAMPLE = {
  id: "preview",
  eventSlug: "harlem-night-market",
  status: "accepted",
  submittedAt: new Date().toISOString(),
  files: [],
  contactName: "Jordan",
  businessName: "Sample Candle Co.",
  email: "vendor@example.com",
  categories: ["Candles"],
  assignedDates: ["2026-12-05", "2026-12-12"],
  marketCategory: "Makers",
  inviteToken: "sample-link-for-preview-only",
} as unknown as StoredApplication;

const TYPES = { invite: inviteEmail, reminder: reminderEmail, decline: declineEmail } as const;

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type") ?? "invite";
  const email =
    type === "receipt"
      ? receiptEmail(SAMPLE, amountDueCents(SAMPLE))
      : (TYPES[type as keyof typeof TYPES] ?? inviteEmail)(SAMPLE);
  const nav = ["invite", "reminder", "decline", "receipt"]
    .map((t) => (t === type ? `<strong>${t}</strong>` : `<a href="?type=${t}">${t}</a>`))
    .join(" · ");
  const page = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Email preview</title>
<body style="margin:0;background:#eee;font-family:Arial,sans-serif">
<div style="background:#0e0e52;color:#fbf3e4;padding:12px 16px;font-size:14px">
Email preview (sample vendor, nothing is sent): ${nav.replace(/<a /g, '<a style="color:#f2832a" ')}
</div>
<div style="max-width:640px;margin:16px auto;background:#fff;padding:24px;border-radius:8px">
<p style="margin:0 0 4px;color:#666;font-size:13px">From: Harlem Night Market &lt;info@harlemnightmarket.com&gt;</p>
<p style="margin:0 0 20px;font-weight:bold">Subject: ${email.subject.replace(/</g, "&lt;")}</p>
${email.html}
</div></body>`;
  return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
