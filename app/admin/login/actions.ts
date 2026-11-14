"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  adminFromUser,
  audit,
  clearAttempts,
  clientIp,
  createSession,
  createUser,
  endAllSessions,
  endSession,
  findUserByEmail,
  hasAdminAccounts,
  hashPassword,
  isLocked,
  loginsAvailable,
  looksLikeEmail,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  recordAttempt,
  SESSION_COOKIE,
  sessionCookie,
  sharedPasswordMatches,
  consumeLinkToken,
  verifyPassword,
} from "@/lib/admin-auth";
import { update } from "@/lib/admin-db";
import { sendSetPasswordLink } from "@/lib/admin-links";

// Signing in and out, the first-account setup, and setting a password from an emailed link.
// These are the only admin actions that work without being signed in.

const field = (form: FormData, key: string) => String(form.get(key) ?? "");

// A new session (and cookie) on every sign-in; any session this browser had is ended.
async function startSession(userId: string) {
  const jar = await cookies();
  const old = jar.get(SESSION_COOKIE)?.value;
  if (old) await endSession(old);
  jar.set(sessionCookie(await createSession(userId)));
}

// Problems with a new password, as the message code for the page, or null when it's fine.
function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) return "short";
  if (password !== confirm) return "mismatch";
  return null;
}

export async function loginAction(form: FormData) {
  if (!(await loginsAvailable())) redirect("/admin/login");
  const email = normalizeEmail(field(form, "email"));
  const password = field(form, "password").slice(0, MAX_PASSWORD_LENGTH);
  const keys = [`email:${email}`, `ip:${clientIp(await headers())}`];
  if (await isLocked(keys)) redirect("/admin/login?m=locked");

  // An unknown or disabled account is checked against a dummy password, so it takes just as long.
  const user = email ? await findUserByEmail(email) : undefined;
  const ok = await verifyPassword(password, user && !user.disabled ? user.password_hash : null);
  if (!ok || !user) {
    await recordAttempt(keys);
    redirect("/admin/login?m=wrong");
  }
  await clearAttempts(keys[0]);
  await startSession(user.id);
  redirect("/admin");
}

// While there are no accounts yet, whoever knows the shared password creates the first one (an owner).
export async function createFirstAdminAction(form: FormData) {
  if (!(await loginsAvailable()) || (await hasAdminAccounts())) redirect("/admin/login");
  const keys = [`ip:${clientIp(await headers())}`];
  if (await isLocked(keys)) redirect("/admin/login?m=locked");
  if (!sharedPasswordMatches(field(form, "shared").slice(0, MAX_PASSWORD_LENGTH))) {
    await recordAttempt(keys);
    redirect("/admin/login?m=wrong-shared");
  }
  const email = normalizeEmail(field(form, "email"));
  if (!looksLikeEmail(email)) redirect("/admin/login?m=bad-email");
  const password = field(form, "password");
  const problem = passwordProblem(password, field(form, "confirm"));
  if (problem) redirect(`/admin/login?m=${problem}`);

  const user = await createUser(email, "owner", await hashPassword(password));
  await audit(adminFromUser(user), "Created the first admin account");
  await startSession(user.id);
  redirect("/admin");
}

// Always gives the same answer, and does the work after responding, so it can't be used to
// find out which addresses are admins. Limited to 5 requests per 15 minutes per IP and per email.
export async function forgotPasswordAction(form: FormData) {
  const email = normalizeEmail(field(form, "email"));
  const keys = [`reset-ip:${clientIp(await headers())}`, `reset-email:${email}`];
  if (looksLikeEmail(email) && (await loginsAvailable()) && !(await isLocked(keys))) {
    await recordAttempt(keys);
    after(async () => {
      const user = await findUserByEmail(email);
      if (user && !user.disabled) await sendSetPasswordLink(user, "reset");
    });
  }
  redirect("/admin/login?m=sent");
}

export async function setPasswordAction(form: FormData) {
  const token = field(form, "token").slice(0, 100);
  const password = field(form, "password");
  const problem = passwordProblem(password, field(form, "confirm"));
  if (problem) redirect(`/admin/set-password?token=${encodeURIComponent(token)}&m=${problem}`);

  const user = await consumeLinkToken(token);
  if (!user) redirect("/admin/login?m=link-expired");
  await update("admin_users", { id: user.id }, { password_hash: await hashPassword(password) });
  await endAllSessions(user.id); // a new password signs out every other browser
  await clearAttempts(`email:${user.email}`);
  await audit(adminFromUser(user), user.password_hash ? "Reset their password" : "Set their password and joined");
  await startSession(user.id);
  redirect("/admin");
}

export async function logoutAction() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await endSession(token);
  jar.set(sessionCookie("", 0));
  redirect("/admin/login?m=out");
}
