"use server";

import { redirect } from "next/navigation";
import {
  activeOwnerCount,
  adminForAction,
  audit,
  createUser,
  endAllSessions,
  findUser,
  findUserByEmail,
  looksLikeEmail,
  normalizeEmail,
  setSharedPasswordEnabled,
} from "@/lib/admin-auth";
import { remove, update } from "@/lib/admin-db";
import { sendSetPasswordLink } from "@/lib/admin-links";

// Managing who can use the admin. Owners only.

const done = (m: string): never => redirect(`/admin/team?m=${m}`);

async function target(form: FormData) {
  const user = await findUser(String(form.get("id") ?? ""));
  if (!user) done("missing");
  return user!;
}

// Whether a change to this user would leave no owner who can sign in.
async function isLastOwner(id: string) {
  const user = await findUser(id);
  return !!user && user.role === "owner" && !user.disabled && !!user.password_hash && (await activeOwnerCount()) <= 1;
}

export async function addAdminAction(form: FormData) {
  const owner = await adminForAction("owner");
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const role = form.get("role") === "owner" ? "owner" : "admin";
  if (!looksLikeEmail(email)) done("bad-email");
  if (await findUserByEmail(email)) done("exists");
  const user = await createUser(email, role, null);
  await audit(owner, "Added an admin", `${email} (${role})`);
  done((await sendSetPasswordLink(user, "invite")) ? "added" : "added-no-email");
}

export async function resendLinkAction(form: FormData) {
  const owner = await adminForAction("owner");
  const user = await target(form);
  await audit(owner, "Sent a set-password link", user.email);
  done((await sendSetPasswordLink(user, user.password_hash ? "reset" : "invite")) ? "link-sent" : "link-not-sent");
}

export async function setRoleAction(form: FormData) {
  const owner = await adminForAction("owner");
  const user = await target(form);
  const role = form.get("role") === "owner" ? "owner" : "admin";
  if (role === "admin" && (await isLastOwner(user.id))) done("last-owner");
  await update("admin_users", { id: user.id }, { role });
  await audit(owner, role === "owner" ? "Made an owner" : "Changed an owner to admin", user.email);
  done("saved");
}

export async function setDisabledAction(form: FormData) {
  const owner = await adminForAction("owner");
  const user = await target(form);
  const disabled = form.get("disabled") === "true";
  if (disabled && (await isLastOwner(user.id))) done("last-owner");
  await update("admin_users", { id: user.id }, { disabled });
  if (disabled) await endAllSessions(user.id);
  await audit(owner, disabled ? "Disabled an admin" : "Re-enabled an admin", user.email);
  done("saved");
}

export async function removeAdminAction(form: FormData) {
  const owner = await adminForAction("owner");
  const user = await target(form);
  if (await isLastOwner(user.id)) done("last-owner");
  await remove("admin_users", { id: user.id });
  await audit(owner, "Removed an admin", user.email);
  done("removed");
}

// The old shared ADMIN_PASSWORD. Once off, it's refused even while the env var is still set.
export async function setSharedPasswordAction(form: FormData) {
  const owner = await adminForAction("owner");
  const on = form.get("on") === "true";
  await setSharedPasswordEnabled(on);
  await audit(owner, on ? "Turned the shared password back on" : "Turned off the shared password");
  done("saved");
}
