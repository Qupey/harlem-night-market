import { declineEmail, inviteEmail, receiptEmail, reminderEmail, REPLY_TO_ALL, sendEmail } from "@/lib/email";
import { amountDueCents } from "@/lib/payments";
import type { StoredApplication } from "@/lib/store";

// Shows what vendors receive: /api/admin/email-preview?type=invite|reminder|decline|receipt
// Uses a made-up vendor and changes no records. Viewing sends nothing; POST { type, to } emails that
// sample to one address, with [TEST] in the subject. Protected by the admin password check in proxy.ts.
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

const NAMES = ["invite", "reminder", "decline", "receipt"];

const sampleEmail = (type: string) =>
  type === "receipt"
    ? receiptEmail(SAMPLE, amountDueCents(SAMPLE))
    : (TYPES[type as keyof typeof TYPES] ?? inviteEmail)(SAMPLE);

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type") ?? "invite";
  const email = sampleEmail(type);
  const nav = NAMES.map((t) => (t === type ? `<strong>${t}</strong>` : `<a href="?type=${t}">${t}</a>`)).join(" · ");
  const options = NAMES.map((t) => `<option value="${t}"${t === type ? " selected" : ""}>${t}</option>`).join("");
  const page = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Email preview</title>
<body style="margin:0;background:#eee;font-family:Arial,sans-serif">
<div style="background:#0e0e52;color:#fbf3e4;padding:12px 16px;font-size:14px">
Email preview (sample vendor, nothing is sent): ${nav.replace(/<a /g, '<a style="color:#f2832a" ')}
</div>
<form id="test" style="max-width:640px;margin:16px auto 0;background:#fff;padding:16px 24px;border-radius:8px;box-sizing:border-box;font-size:14px">
<p style="margin:0 0 10px;font-weight:bold">Send me a test</p>
<div style="display:flex;flex-wrap:wrap;gap:8px">
<input id="to" type="email" required placeholder="you@example.com" aria-label="Send the test to" style="flex:1 1 200px;min-width:0;padding:8px;font-size:16px;border:1px solid #bbb;border-radius:6px">
<select id="kind" aria-label="Email to send" style="padding:8px;font-size:16px;border:1px solid #bbb;border-radius:6px">${options}</select>
<button id="send" type="submit" style="padding:8px 16px;font-size:16px;font-weight:bold;background:#f2832a;color:#0e0e52;border:0;border-radius:6px;cursor:pointer">Send test</button>
</div>
<p id="result" role="status" style="margin:10px 0 0;font-weight:bold"></p>
<p style="margin:10px 0 0;color:#666;font-size:13px">Uses the sample vendor and goes only to this address. The Pay button in test emails won't open a real payment. Replying to a test goes to ${REPLY_TO_ALL.join(" and ")}.</p>
</form>
<div style="max-width:640px;margin:16px auto;background:#fff;padding:24px;border-radius:8px">
<p style="margin:0 0 4px;color:#666;font-size:13px">From: Harlem Night Market &lt;info@harlemnightmarket.com&gt;</p>
<p style="margin:0 0 4px;color:#666;font-size:13px">Replies go to: ${REPLY_TO_ALL.join(", ")}</p>
<p style="margin:0 0 20px;font-weight:bold">Subject: ${email.subject.replace(/</g, "&lt;")}</p>
${email.html}
</div>
<script>
const to = document.getElementById("to"), kind = document.getElementById("kind"), send = document.getElementById("send"), result = document.getElementById("result");
try { to.value = localStorage.getItem("hnm-test-email") || ""; } catch {}
document.getElementById("test").addEventListener("submit", async (e) => {
  e.preventDefault();
  try { localStorage.setItem("hnm-test-email", to.value); } catch {}
  send.disabled = true;
  result.style.color = "#666";
  result.textContent = "Sending...";
  try {
    const res = await fetch(location.pathname, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: kind.value, to: to.value }) });
    const body = await res.json().catch(() => null);
    result.style.color = res.ok ? "#0a7a5c" : "#c0264f";
    result.textContent = res.ok ? "Sent to " + to.value + ". Check your inbox and spam folder." : (body && body.error) || "The test didn't send.";
  } catch {
    result.style.color = "#c0264f";
    result.textContent = "The test didn't send. Check your connection and try again.";
  }
  send.disabled = false;
});
</script>
</body>`;
  return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  // A form on another site can't send JSON here, so a logged-in admin's browser can't be tricked into sending.
  if (request.headers.get("content-type") !== "application/json") {
    return Response.json({ error: "Expected JSON" }, { status: 415 });
  }
  const body = await request.json().catch(() => null);
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  if (!NAMES.includes(body?.type)) return Response.json({ error: "Unknown email" }, { status: 400 });
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) {
    return Response.json({ error: "Enter one valid email address." }, { status: 400 });
  }
  const email = sampleEmail(body.type);
  const result = await sendEmail(to, { ...email, subject: `[TEST] ${email.subject}` });
  if (!result.sent) return Response.json({ error: result.error }, { status: 502 });
  return Response.json({ sent: true }, { headers: { "Cache-Control": "no-store" } });
}
