"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminAuthorization } from "@/lib/admin-auth";
import { getEvent } from "@/lib/events";
import { MARKET_CATEGORIES, STATUS_LABELS } from "@/lib/selection";
import { listApplications, setStarred, updateSelection, type StoredApplication } from "@/lib/store";

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

export async function toggleStarAction(form: FormData) {
  if (!isAdminAuthorization((await headers()).get("authorization"))) throw new Error("Not authorized");

  const id = String(form.get("id") ?? "");
  const result = await setStarred(id, form.get("starred") === "1");

  const back = new URLSearchParams(String(form.get("back") ?? ""));
  if (result.columnsMissing) back.set("saved", "star-missing");
  const returnTo = form.get("returnTo") === "/admin/requests" ? "/admin/requests" : "/admin";
  const formAnchor = String(form.get("anchor") ?? "");
  const anchor = /^[\w-]+$/.test(formAnchor) ? formAnchor : `app-${id}`;
  redirect(`${returnTo}?${back}#${anchor}`);
}
