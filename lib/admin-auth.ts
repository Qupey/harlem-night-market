import "server-only";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { headers } from "next/headers";
import { AdminTablesMissing, type AdminUserRow, find, findOne, insert, remove, update, upsert } from "./admin-db";

// Who may use the admin. Each admin signs in with their own email and password (sessions in
// the admin_* tables from supabase/add-admin-logins.sql). The old shared ADMIN_PASSWORD (HTTP
// Basic Auth) keeps working until an owner turns it off on /admin/team, and is the only way in
// while those tables don't exist yet. Checked by proxy.ts and again inside every admin API route
// and Server Action, so none of them can be called from anywhere else.

export type Admin = { id: string | null; email: string; role: "owner" | "admin"; via: "session" | "shared" };

const SHARED_ADMIN: Admin = { id: null, email: "shared password", role: "admin", via: "shared" };

export const SESSION_COOKIE = "__Host-hnm_admin";
const SESSION_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

const now = () => new Date().toISOString();
const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();

// Compares SHA-256 digests in constant time, so neither the contents nor the length leak.
export function safeEqual(a: string, b: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export function sharedPasswordMatches(supplied: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  return !!password && safeEqual(supplied, password);
}

// The shared password sent as HTTP Basic Auth (any user name).
export function isAdminAuthorization(header: string | null): boolean {
  if (!header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false; // not valid base64
  }
  return sharedPasswordMatches(decoded.slice(decoded.indexOf(":") + 1));
}

// --- Setup state -------------------------------------------------------------

// Whether supabase/add-admin-logins.sql has been run. A "no" is rechecked every minute.
let tables: { ok: boolean; at: number } | undefined;
export async function loginsAvailable(): Promise<boolean> {
  if (tables && (tables.ok || Date.now() - tables.at < 60_000)) return tables.ok;
  try {
    await find("admin_users", {}, { limit: 1 });
    tables = { ok: true, at: Date.now() };
  } catch (err) {
    if (!(err instanceof AdminTablesMissing)) throw err;
    tables = { ok: false, at: Date.now() };
  }
  return tables.ok;
}

export async function hasAdminAccounts(): Promise<boolean> {
  return (await find("admin_users", {}, { limit: 1 })).length > 0;
}

// The owner's switch on /admin/team. Cached for a few seconds to save a database call per request.
let shared: { on: boolean; at: number } | undefined;
export async function sharedPasswordEnabled(): Promise<boolean> {
  if (!(await loginsAvailable())) return true;
  if (shared && Date.now() - shared.at < 10_000) return shared.on;
  const row = await findOne("admin_settings", { key: "shared_password" });
  shared = { on: row?.value !== "off", at: Date.now() };
  return shared.on;
}

export async function setSharedPasswordEnabled(on: boolean) {
  await upsert("admin_settings", { key: "shared_password", value: on ? "on" : "off", updated_at: now() }, "key");
  shared = undefined;
}

// --- Passwords -----------------------------------------------------------------

const SCRYPT = { N: 16384, r: 8, p: 1 };
const scrypt = (password: string, salt: Buffer, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, 64, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

// Checked against when there is no account, so an unknown email takes as long as a wrong password.
const DUMMY_HASH = ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, Buffer.alloc(16).toString("base64"), Buffer.alloc(64).toString("base64")].join("$");

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = (stored || DUMMY_HASH).split("$");
  if (scheme !== "scrypt") return false;
  const key = await scrypt(password, Buffer.from(salt, "base64"), { N: Number(N), r: Number(r), p: Number(p) });
  const expected = Buffer.from(hash, "base64");
  return !!stored && key.length === expected.length && timingSafeEqual(key, expected);
}

// --- Users -----------------------------------------------------------------------

export const normalizeEmail = (email: string) => email.trim().toLowerCase().slice(0, 254);
export const looksLikeEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const findUserByEmail = (email: string) => findOne("admin_users", { email: normalizeEmail(email) });
export const findUser = (id: string) => findOne("admin_users", { id });
export const listUsers = () => find("admin_users", {}, { order: "created_at" });

export async function createUser(email: string, role: Admin["role"], passwordHash: string | null): Promise<AdminUserRow> {
  return insert("admin_users", { email: normalizeEmail(email), role, password_hash: passwordHash, disabled: false, created_at: now() });
}

export const adminFromUser = (u: AdminUserRow): Admin => ({ id: u.id, email: u.email, role: u.role, via: "session" });

// Owners who can actually sign in. The last one can't be removed, disabled or demoted.
export async function activeOwnerCount(): Promise<number> {
  return (await find("admin_users", { role: "owner", disabled: false })).filter((u) => u.password_hash).length;
}

// --- Sessions ----------------------------------------------------------------------

const newToken = () => randomBytes(32).toString("base64url");
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function sessionCookie(token: string, maxAge = SESSION_DAYS * 24 * 60 * 60) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge };
}

// Returns the new session's token, for the cookie. Only its hash is stored.
export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  await insert("admin_sessions", {
    token_hash: hashToken(token),
    user_id: userId,
    created_at: now(),
    expires_at: inMs(SESSION_DAYS * DAY),
    last_seen: now(),
  });
  return token;
}

export async function endSession(token: string) {
  if (token.length <= 100 && (await loginsAvailable())) await remove("admin_sessions", { token_hash: hashToken(token) });
}

export const endAllSessions = (userId: string) => remove("admin_sessions", { user_id: userId });

function readCookie(header: string | null, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
}

// The admin a session token belongs to. Sessions last 7 days from the last visit; the expiry
// moves forward at most once an hour, and `slid` tells proxy.ts to resend the cookie.
async function sessionAdmin(token: string | undefined): Promise<{ admin: Admin; slid: boolean } | null> {
  if (!token || token.length > 100 || !(await loginsAvailable())) return null;
  const tokenHash = hashToken(token);
  const session = await findOne("admin_sessions", { token_hash: tokenHash });
  if (!session || Date.parse(session.expires_at) <= Date.now()) return null;
  const user = await findUser(session.user_id);
  if (!user || user.disabled || !user.password_hash) return null;
  const slid = Date.now() - Date.parse(session.last_seen) > 60 * 60 * 1000;
  if (slid) await update("admin_sessions", { token_hash: tokenHash }, { last_seen: now(), expires_at: inMs(SESSION_DAYS * DAY) });
  return { admin: adminFromUser(user), slid };
}

export async function authenticate(h: Headers): Promise<{ admin: Admin; slid: boolean; token?: string } | null> {
  const token = readCookie(h.get("cookie"), SESSION_COOKIE);
  const fromSession = await sessionAdmin(token);
  if (fromSession) return { ...fromSession, token };
  if (isAdminAuthorization(h.get("authorization")) && (await sharedPasswordEnabled())) return { admin: SHARED_ADMIN, slid: false };
  return null;
}

// For admin API routes: the signed-in admin, or null (send unauthorized()).
export async function requireAdmin(request: Request): Promise<Admin | null> {
  return (await authenticate(request.headers))?.admin ?? null;
}

export function unauthorized(): Response {
  return new Response("Authentication required", { status: 401 });
}

// For pages and Server Actions.
export async function currentAdmin(): Promise<Admin | null> {
  return (await authenticate(await headers()))?.admin ?? null;
}

export async function adminForAction(role?: "owner"): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin || (role && (admin.role !== role || admin.via !== "session"))) throw new Error("Not authorized");
  return admin;
}

// --- Failed sign-ins ------------------------------------------------------------------

// Five tries per key (an email address or an IP address) in 15 minutes, then 15 minutes locked.
const WINDOW = 15 * 60 * 1000;
const MAX_TRIES = 5;

export async function isLocked(keys: string[]): Promise<boolean> {
  for (const key of keys) {
    const row = await findOne("admin_login_attempts", { key });
    if (row?.locked_until && Date.parse(row.locked_until) > Date.now()) return true;
  }
  return false;
}

export async function recordAttempt(keys: string[]) {
  for (const key of keys) {
    const row = await findOne("admin_login_attempts", { key });
    const fresh = !row || Date.now() - Date.parse(row.first_at) > WINDOW;
    const count = fresh ? 1 : row.count + 1;
    await upsert(
      "admin_login_attempts",
      { key, count, first_at: fresh ? now() : row.first_at, locked_until: count >= MAX_TRIES ? inMs(WINDOW) : null },
      "key",
    );
  }
}

export const clearAttempts = (key: string) => remove("admin_login_attempts", { key });

export function clientIp(h: Headers): string {
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim().slice(0, 64);
}

// --- Set-password links ------------------------------------------------------------------

// A single-use token for the link in an invite or reset email, valid for 24 hours. Making a
// new one cancels the user's older unused links.
export async function createLinkToken(userId: string): Promise<string> {
  await update("admin_tokens", { user_id: userId, used_at: null }, { used_at: now() });
  const token = newToken();
  await insert("admin_tokens", { token_hash: hashToken(token), user_id: userId, created_at: now(), expires_at: inMs(DAY), used_at: null });
  return token;
}

// The user a link is for, without using it up (for showing the form).
export async function linkTokenUser(token: string): Promise<AdminUserRow | undefined> {
  if (token.length > 100 || !(await loginsAvailable())) return undefined;
  const row = await findOne("admin_tokens", { token_hash: hashToken(token), used_at: null });
  if (!row || Date.parse(row.expires_at) <= Date.now()) return undefined;
  const user = await findUser(row.user_id);
  return user && !user.disabled ? user : undefined;
}

// Uses the link up; returns its user, or undefined if it was already used, expired or unknown.
export async function consumeLinkToken(token: string): Promise<AdminUserRow | undefined> {
  if (token.length > 100 || !(await loginsAvailable())) return undefined;
  const [row] = await update("admin_tokens", { token_hash: hashToken(token), used_at: null }, { used_at: now() });
  if (!row || Date.parse(row.expires_at) <= Date.now()) return undefined;
  const user = await findUser(row.user_id);
  return user && !user.disabled ? user : undefined;
}

// --- Audit trail ----------------------------------------------------------------------------

// Records who did what. Never blocks the change itself.
export async function audit(admin: Admin, action: string, detail = "") {
  try {
    if (!(await loginsAvailable())) return;
    await insert("admin_audit", { at: now(), admin_email: admin.email, action, detail: detail.slice(0, 500) });
  } catch (err) {
    console.error("Recording the admin audit trail failed:", err);
  }
}

export const recentAudit = () => find("admin_audit", {}, { order: "id", desc: true, limit: 50 });
