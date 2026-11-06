import "server-only";
import { getEvent } from "./events";
import {
  amountDueCents,
  assignedDateLabels,
  dollars,
  feePerDateCents,
  HOT_FOOD_FEE_CENTS,
  OVERDUE_AFTER_DAYS,
  payLink,
  REFUND_POLICY,
  STANDARD_FEE_CENTS,
} from "./payments";
import type { StoredApplication } from "./store";

// Vendor emails, sent through Resend (https://resend.com) from info@harlemnightmarket.com. Replies go to Carey and Tony.
// Without RESEND_API_KEY nothing is sent and callers get { sent: false }.

const FROM = process.env.EMAIL_FROM || "Harlem Night Market <info@harlemnightmarket.com>";

// Everyone a vendor's reply goes to. The first address is the contact shown to vendors.
export const REPLY_TO_ALL = (process.env.REPLY_TO_EMAIL || "carey@uptowngrandcentral.org,tony@tbo.media")
  .split(",")
  .map((address) => address.trim())
  .filter(Boolean);
export const REPLY_TO = REPLY_TO_ALL[0];

export type EmailResult = { sent: true } | { sent: false; error: string };

type Email = { subject: string; text: string; html: string };

export async function sendEmail(to: string, email: Email): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, error: "Email isn't set up yet (RESEND_API_KEY is missing)." };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO_ALL, ...email }),
  });
  if (res.ok) return { sent: true };
  const detail = await res.text().catch(() => "");
  return { sent: false, error: `Email to ${to} failed (${res.status}) ${detail.slice(0, 200)}` };
}

// --- Templates -------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type EmailPart = string | string[] | { button: string; href: string } | { heading: string } | { lines: string[] };

// Builds the plain-text and HTML versions from the same parts: paragraphs, bullet lists (arrays),
// buttons, section headings and blocks of consecutive lines.
function compose(subject: string, parts: EmailPart[]): Email {
  const text = parts
    .map((p) => {
      if (typeof p === "string") return p;
      if (Array.isArray(p)) return p.map((x) => `  • ${x}`).join("\n");
      if ("heading" in p) return p.heading.toUpperCase();
      if ("lines" in p) return p.lines.join("\n");
      return `${p.button}: ${p.href}`;
    })
    .join("\n\n");
  const body = parts
    .map((p) =>
      typeof p === "string"
        ? `<p style="margin:0 0 16px">${esc(p)}</p>`
        : Array.isArray(p)
          ? `<ul style="margin:0 0 16px;padding-left:20px">${p.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
          : "heading" in p
            ? `<p style="margin:28px 0 8px;font-weight:bold;letter-spacing:0.04em;color:#0e0e52">${esc(p.heading.toUpperCase())}</p>`
            : "lines" in p
              ? `<p style="margin:0 0 16px">${p.lines.map(esc).join("<br>")}</p>`
              : `<p style="margin:24px 0"><a href="${esc(p.href)}" style="background:#f2832a;color:#0e0e52;font-weight:bold;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block">${esc(p.button)}</a></p>`,
    )
    .join("");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1d1d1d;max-width:560px">${body}</div>`;
  return { subject, text, html };
}

const signoff = `Harlem Night Market team\n${REPLY_TO}`;

function feeLines(a: StoredApplication) {
  const each = dollars(feePerDateCents(a));
  return assignedDateLabels(a).map((d) => `${d} · ${each}`);
}

export function inviteEmail(a: StoredApplication): Email {
  const event = getEvent(a.eventSlug);
  const total = dollars(amountDueCents(a));
  const dateLines = (a.assignedDates ?? []).map((id) => {
    const d = event?.dates.find((x) => x.id === id);
    return d ? `${d.label.replace(/, \d{4}$/, "")} | ${d.time}` : id;
  });
  return compose("Welcome to the Harlem Night Market! Confirm your space", [
    `Dear ${a.contactName},`,
    `This email is to welcome ${a.businessName} to the Harlem Night Market!`,
    "This year's market will be held at either, La Placita, the glass-enclosed space under the tracks at 115th and 116th Streets, OR at Lot 2 and the Urban Garden Center, located under the Park Avenue Viaduct between 111th and 113th Streets.",
    "These two lots are adjacent to each other, with Lot 2 featuring new bright orange and yellow shipping containers for many of our food vendors, and Urban Garden Center featuring Christmas trees, wreaths, and a festive holiday atmosphere for many of our makers.",
    "We will keep you posted on where the market ends up. We are still awaiting final details from the NYC Economic Development Corporation. Our fingers are crossed to get back into La Placita.",
    { heading: "Dates" },
    "We have a space for you on the following date(s):",
    dateLines,
    "Your participation will be fully confirmed once we receive:",
    { lines: ["1. Your vendor fee(s)", "2. Your insurance and required paperwork"] },
    "Details are provided below.",
    { heading: "Vendor fees" },
    "The fee for each night of the market is:",
    [
      `${dollars(STANDARD_FEE_CENTS)} for makers, art, packaged food, desserts and beverages`,
      `${dollars(HOT_FOOD_FEE_CENTS)} for hot food and food truck vendors`,
    ],
    `Your total for ${dateLines.length} ${dateLines.length === 1 ? "date" : "dates"} is ${total}. Your space is not held until your fee is paid, so please pay within ${OVERDUE_AFTER_DAYS} days to keep your spot.`,
    { button: `Pay ${total} and confirm my space`, href: payLink(a.inviteToken!) },
    REFUND_POLICY,
    { heading: "Insurance & vendor release form" },
    "The NYC Economic Development Corporation (NYC EDC), which manages La Marqueta, requires the following documentation:",
    "1. Certificate of Insurance. Please submit a Certificate of Insurance listing the following as additional insured:",
    { lines: ["The City of New York & NYC Economic Development Corporation", "1 Liberty Plaza", "New York, NY 10006"] },
    "2. Vendor Release Form. We'll send the Vendor Release Form for you to review, sign and return.",
    "If you haven't already uploaded them, please reply to this email with your documents.",
    { heading: "Food vendor requirements" },
    "NYC EDC also requires each food vendor to submit the following:",
    ["Food Handler's License or ServSafe Certification", "TFSE Permit or Home Processor Registration"],
    { heading: "Vendor calls" },
    "We'll be hosting group Zoom calls before each market to review logistics and answer questions. Please look out for calendar invitations with meeting links, along with promotional materials you can share with your customers and community.",
    `We're looking forward to a wonderful market season and are excited to have ${a.businessName} join us!`,
    { lines: ["Take care,", "Carey (+ Tony)"] },
    {
      lines: [
        "Carey King",
        "Director, Uptown Grand Central",
        "Email: carey@uptowngrandcentral.org",
        "Phone: 212-457-1254",
      ],
    },
    { lines: ["Tony Rahsaan", "Founder, TBo Harlem", "e. tony@tbo.media", "p. 917.406.6496"] },
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
