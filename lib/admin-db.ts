import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Storage for admin logins: the admin_* tables from supabase/add-admin-logins.sql, or
// ./data/admin.json when Supabase isn't configured. Rows use the same column names in both.

export type AdminUserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  role: "owner" | "admin";
  disabled: boolean;
  created_at: string;
};
export type AdminSessionRow = { token_hash: string; user_id: string; created_at: string; expires_at: string; last_seen: string };
export type AdminTokenRow = { token_hash: string; user_id: string; created_at: string; expires_at: string; used_at: string | null };
export type LoginAttemptRow = { key: string; count: number; first_at: string; locked_until: string | null };
export type SettingRow = { key: string; value: unknown; updated_at: string };
export type AuditRow = { id: number; at: string; admin_email: string; action: string; detail: string };

type Tables = {
  admin_users: AdminUserRow;
  admin_sessions: AdminSessionRow;
  admin_tokens: AdminTokenRow;
  admin_login_attempts: LoginAttemptRow;
  admin_settings: SettingRow;
  admin_audit: AuditRow;
};
type Name = keyof Tables;
type Match<N extends Name> = Partial<Tables[N]>;

// Thrown when the SQL hasn't been run yet; callers then fall back to the shared password.
export class AdminTablesMissing extends Error {}

const supabaseOn = () => !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY;

let client: SupabaseClient | undefined;
function db(): SupabaseClient {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

function check<T>(result: { data: T | null; error: { code?: string; message: string } | null }, what: string): T {
  const { data, error } = result;
  if (!error) return data as T;
  if (["42P01", "PGRST205"].includes(error.code ?? "") || /admin_\w+.*(does not exist|schema cache)/.test(error.message)) {
    throw new AdminTablesMissing(error.message);
  }
  throw new Error(`${what} failed: ${error.message}`);
}

// --- Local file --------------------------------------------------------------

const FILE = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "admin.json");
type FileData = { [N in Name]?: Tables[N][] };
let writeQueue: Promise<unknown> = Promise.resolve();

async function readData(): Promise<FileData> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as FileData;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

// Runs a change to the file one at a time, so two requests can't overwrite each other.
function changeData<T>(fn: (data: FileData) => T): Promise<T> {
  const run = writeQueue.then(async () => {
    const data = await readData();
    const result = fn(data);
    await mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2));
    await rename(tmp, FILE);
    return result;
  });
  writeQueue = run.catch(() => undefined);
  return run;
}

const matches = <N extends Name>(row: Tables[N], match: Match<N>) =>
  Object.entries(match).every(([k, v]) => (row as Record<string, unknown>)[k] === v);

// --- Table operations ----------------------------------------------------------

type FindOptions = { order?: string; desc?: boolean; limit?: number };

export async function find<N extends Name>(table: N, match: Match<N> = {}, opts: FindOptions = {}): Promise<Tables[N][]> {
  if (supabaseOn()) {
    let q = db().from(table).select("*");
    for (const [k, v] of Object.entries(match)) q = v === null ? q.is(k, null) : q.eq(k, v as string);
    if (opts.order) q = q.order(opts.order, { ascending: !opts.desc });
    if (opts.limit) q = q.limit(opts.limit);
    return check(await q, `Reading ${table}`) as Tables[N][];
  }
  let rows = ((await readData())[table] ?? []).filter((r) => matches(r as Tables[N], match)) as Tables[N][];
  if (opts.order) {
    const key = opts.order as keyof Tables[N];
    rows = rows.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (opts.desc ? -1 : 1));
  }
  return opts.limit ? rows.slice(0, opts.limit) : rows;
}

export async function findOne<N extends Name>(table: N, match: Match<N>): Promise<Tables[N] | undefined> {
  return (await find(table, match, { limit: 1 }))[0];
}

export async function insert<N extends Name>(table: N, row: Omit<Tables[N], "id"> & Partial<Tables[N]>): Promise<Tables[N]> {
  if (supabaseOn()) return check(await db().from(table).insert(row).select().single(), `Saving ${table}`) as Tables[N];
  return changeData((data) => {
    const rows = (data[table] ??= []) as Tables[N][];
    const full = { ...row } as Tables[N] & { id?: string | number };
    if (table === "admin_users" && !full.id) full.id = crypto.randomUUID();
    if (table === "admin_audit") full.id = rows.reduce((m, r) => Math.max(m, Number((r as AuditRow).id)), 0) + 1;
    if (table === "admin_users" && rows.some((r) => (r as AdminUserRow).email === (full as AdminUserRow).email)) {
      throw new Error("Saving admin_users failed: duplicate email");
    }
    rows.push(full);
    return full;
  });
}

// Inserts the row, or replaces the one with the same key column.
export async function upsert<N extends Name>(table: N, row: Tables[N], key: keyof Tables[N]): Promise<void> {
  if (supabaseOn()) {
    check(await db().from(table).upsert(row, { onConflict: String(key) }), `Saving ${table}`);
    return;
  }
  await changeData((data) => {
    const rows = ((data[table] ??= []) as Tables[N][]).filter((r) => r[key] !== row[key]);
    rows.push(row);
    (data as Record<string, unknown>)[table] = rows;
  });
}

// Returns the rows that were changed.
export async function update<N extends Name>(table: N, match: Match<N>, patch: Partial<Tables[N]>): Promise<Tables[N][]> {
  if (supabaseOn()) {
    let q = db().from(table).update(patch as never);
    for (const [k, v] of Object.entries(match)) q = v === null ? q.is(k, null) : q.eq(k, v as string);
    return check(await q.select(), `Saving ${table}`) as Tables[N][];
  }
  return changeData((data) => {
    const changed: Tables[N][] = [];
    for (const r of (data[table] ?? []) as Tables[N][]) {
      if (!matches(r, match)) continue;
      Object.assign(r, patch);
      changed.push(r);
    }
    return changed;
  });
}

export async function remove<N extends Name>(table: N, match: Match<N>): Promise<void> {
  if (supabaseOn()) {
    let q = db().from(table).delete();
    for (const [k, v] of Object.entries(match)) q = v === null ? q.is(k, null) : q.eq(k, v as string);
    check(await q, `Deleting from ${table}`);
    return;
  }
  await changeData((data) => {
    (data as Record<string, unknown>)[table] = ((data[table] ?? []) as Tables[N][]).filter((r) => !matches(r, match));
    // Removing a user also removes their sessions and links, like the database's cascade.
    const userId = (match as { id?: unknown }).id;
    if (table === "admin_users" && typeof userId === "string") {
      data.admin_sessions = (data.admin_sessions ?? []).filter((s) => s.user_id !== userId);
      data.admin_tokens = (data.admin_tokens ?? []).filter((t) => t.user_id !== userId);
    }
  });
}
