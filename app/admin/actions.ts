"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminAuthorization } from "@/lib/admin-auth";
import { getEvent } from "@/lib/events";
import { MARKET_CATEGORIES, STATUS_LABELS } from "@/lib/selection";
import { declineEmail, inviteEmail, reminderEmail, sendEmail } from "@/lib/email";
import { amountDueCents, canBeInvited, newInviteToken } from "@/lib/payments";
import {
  deleteApplication,
  listApplications,
  updatePayment,
  updateSelection,
  type StoredApplication,
} from "@/lib/store";

export async function saveSelectionAction(form: FormData) {
  if (!isAdminAuthorization((await headers()).get("authorization"))) throw new Error("Not authorized");

  const id = String(form.get("id") ?? "");
  const app = (await listApplications()).find((a) => a.id === id);
  const status = String(form.get("status")) as StoredApplication["status"];
  if (!app || !(status in STATUS_LABELS)) throw new Error("Unknown application or status");

  const validDates = new Set(getEvent(app.eventSlug)?.dates.map((d) => d.id));
  const assignedDates = form.getAll("assignedDates").map(String).filter((d) => validDates.has(d)).sort();
  const category = String(form.get("marketCategory") ?? "");
  const marketCategory = (MARKET_CATEGORIES as readonly string[]).includes(category) ? category : "";

  const result = await updateSelection(id, { status, assignedDates, marketCategory });

  // Back to the same filtered list, with a note on what happened.
  const back = new URLSearchParams(String(form.get("back") ?? ""));
  back.set("saved", result.columnsMissing ? "status-only" : "1");
  // Reopen the card that was saved; the same vendor can appear more than once on /admin/requests.
  const returnTo = form.get("returnTo") === "/admin/requests" ? "/admin/requests" : "/admin";
  const formAnchor = String(form.get("anchor") ?? "");
  const anchor = /^[\w-]+$/.test(formAnchor) ? formAnchor : `app-${id}`;
  back.set("open", anchor);
  redirect(`${returnTo}?${back}#${anchor}`);
}

export async function deleteApplicationAction(form: FormData) {
  if (!isAdminAuthorization((await headers()).get("authorization"))) throw new Error("Not authorized");

  const deleted = await deleteApplication(String(form.get("id") ?? ""));

  const back = new URLSearchParams(String(form.get("back") ?? ""));
  back.set("saved", deleted ? "deleted" : "delete-missing");
  const returnTo = form.get("returnTo") === "/admin/requests" ? "/admin/requests" : "/admin";
  redirect(`${returnTo}?${back}`);
}

// --- Vendor fees -------------------------------------------------------------

// Where to land after a payment action: the same filtered list, with a note, scrolled to the card.
function backTo(form: FormData, saved: string, id?: string): never {
  const back = new URLSearchParams(String(form.get("back") ?? ""));
  back.set("saved", saved);
  const returnTo = form.get("returnTo") === "/admin/requests" ? "/admin/requests" : "/admin";
  const formAnchor = String(form.get("anchor") ?? "");
  const anchor = /^[\w-]+$/.test(formAnchor) ? formAnchor : id ? `app-${id}` : "";
  if (anchor) back.set("open", anchor);
  redirect(`${returnTo}?${back}${anchor ? `#${anchor}` : ""}`);
}

async function requireAdmin() {
  if (!isAdminAuthorization((await headers()).get("authorization"))) throw new Error("Not authorized");
}

// Emails each selected vendor their payment link and starts their 10-day clock.
// Used by the button on one card and by "Send invites to selected".
export async function sendInvitesAction(form: FormData) {
  await requireAdmin();
  const ids = new Set(form.getAll("ids").map(String));
  const apps = (await listApplications()).filter((a) => ids.has(a.id));
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const a of apps) {
    if (!canBeInvited(a)) {
      skipped++;
      continue;
    }
    const inviteToken = a.inviteToken ?? newInviteToken();
    if (!a.inviteToken) {
      const saved = await updatePayment(a.id, { inviteToken });
      if (saved.columnsMissing) backTo(form, "payments-missing", ids.size === 1 ? a.id : undefined);
    }
    const result = await sendEmail(a.email, inviteEmail({ ...a, inviteToken }));
    if (!result.sent) {
      failed++;
      continue;
    }
    await updatePayment(a.id, { invitedAt: a.invitedAt ?? new Date().toISOString() });
    sent++;
  }
  backTo(form, `invites-${sent}-${failed}-${skipped}`, ids.size === 1 ? [...ids][0] : undefined);
}

export async function sendReminderAction(form: FormData) {
  await requireAdmin();
  const a = await findApp(form);
  if (!canBeInvited(a) || !a.inviteToken) backTo(form, "email-skipped", a.id);
  const result = await sendEmail(a.email, reminderEmail(a));
  if (!result.sent) backTo(form, "email-failed", a.id);
  await updatePayment(a.id, { reminderSentAt: new Date().toISOString() });
  backTo(form, "email-sent", a.id);
}

export async function sendDeclineEmailAction(form: FormData) {
  await requireAdmin();
  const a = await findApp(form);
  if (a.status !== "rejected") backTo(form, "email-skipped", a.id);
  const result = await sendEmail(a.email, declineEmail(a));
  if (!result.sent) backTo(form, "email-failed", a.id);
  const saved = await updatePayment(a.id, { declineEmailedAt: new Date().toISOString() });
  backTo(form, saved.columnsMissing ? "payments-missing" : "email-sent", a.id);
}

// For fees paid outside Stripe (cash, Zelle...).
export async function markPaidAction(form: FormData) {
  await requireAdmin();
  const a = await findApp(form);
  const method = ["cash", "zelle", "other"].includes(String(form.get("method"))) ? String(form.get("method")) : "other";
  const typed = Math.round(Number(String(form.get("amount") ?? "").replace(/[$,\s]/g, "")) * 100);
  const amountCents = Number.isFinite(typed) && typed > 0 ? typed : amountDueCents(a);
  const saved = await updatePayment(a.id, {
    paid: true,
    amountPaidCents: amountCents,
    paidAt: new Date().toISOString(),
    paymentId: null,
    paymentMethod: method,
  });
  backTo(form, saved.columnsMissing ? "payments-missing" : "paid", a.id);
}

// Undo a payment recorded by mistake. Refunds themselves are done in the Stripe dashboard.
export async function markUnpaidAction(form: FormData) {
  await requireAdmin();
  const a = await findApp(form);
  await updatePayment(a.id, { paid: false, amountPaidCents: null, paidAt: null, paymentId: null, paymentMethod: null });
  backTo(form, "unpaid", a.id);
}

async function findApp(form: FormData) {
  const id = String(form.get("id") ?? "");
  const a = (await listApplications()).find((x) => x.id === id);
  if (!a) throw new Error("Unknown application");
  return a;
}
