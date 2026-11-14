import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentAdmin, listUsers, loginsAvailable, recentAudit, sharedPasswordEnabled } from "@/lib/admin-auth";
import {
  addAdminAction,
  removeAdminAction,
  resendLinkAction,
  setDisabledAction,
  setRoleAction,
  setSharedPasswordAction,
} from "./actions";

export const metadata = { title: "Admin team | Harlem Night Market admin" };

const MESSAGES: Record<string, string> = {
  added: "Added. They've been emailed a link to set their password (it works once, for 24 hours).",
  "added-no-email": "Added, but the email didn't send. Use Send link to try again.",
  "link-sent": "Link sent. It works once, for 24 hours.",
  "link-not-sent": "The email didn't send. Check the Resend settings and try again.",
  "bad-email": "Enter a valid email address.",
  exists: "That email is already on the team.",
  "last-owner": "There has to be at least one owner who can sign in. Make someone else an owner first.",
  missing: "That admin no longer exists.",
  saved: "Saved.",
  removed: "Removed.",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });

export default function TeamPage({ searchParams }: PageProps<"/admin/team">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-gold">Harlem Night Market admin</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="display text-4xl text-orange">Admin team</h1>
        <Link href="/admin" className="text-sm text-muted underline">
          ← Back to applications
        </Link>
      </div>
      <Suspense fallback={<p className="mt-8 text-muted">Loading...</p>}>
        <Team searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Team({ searchParams }: Pick<PageProps<"/admin/team">, "searchParams">) {
  await connection();
  const admin = await currentAdmin();
  if (!(await loginsAvailable())) {
    return <p className="mt-6 text-cream">Run supabase/add-admin-logins.sql in the Supabase SQL Editor to set up admin accounts.</p>;
  }
  if (admin?.role !== "owner" || admin.via !== "session") {
    return <p className="mt-6 text-cream">Only owners, signed in with their own account, can manage the team.</p>;
  }
  const m = (await searchParams).m;
  const [users, log, shared] = await Promise.all([listUsers(), recentAudit(), sharedPasswordEnabled()]);
  const btn = "rounded-lg border border-line px-2.5 py-1 text-xs text-cream hover:border-cream/50";

  return (
    <>
      {typeof m === "string" && MESSAGES[m] && (
        <p role="status" className="mt-6 rounded-lg bg-teal/15 px-4 py-3 text-sm text-cream">
          {MESSAGES[m]}
        </p>
      )}

      <section className="mt-8 rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-lg font-extrabold text-cream">Admins</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm text-cream">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 pr-4">
                    {u.email}
                    {u.id === admin.id && <span className="text-muted"> (you)</span>}
                  </td>
                  <td className="py-2 pr-4">{u.role === "owner" ? "Owner" : "Admin"}</td>
                  <td className="py-2 pr-4">{u.disabled ? "Disabled" : u.password_hash ? "Active" : "Invited"}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Action action={setRoleAction} id={u.id} name="role" value={u.role === "owner" ? "admin" : "owner"} className={btn}>
                        {u.role === "owner" ? "Make admin" : "Make owner"}
                      </Action>
                      {!u.disabled && (
                        <Action action={resendLinkAction} id={u.id} className={btn}>
                          Send link
                        </Action>
                      )}
                      <Action action={setDisabledAction} id={u.id} name="disabled" value={String(!u.disabled)} className={btn}>
                        {u.disabled ? "Enable" : "Disable"}
                      </Action>
                      <Action action={removeAdminAction} id={u.id} className={`${btn} text-orange`}>
                        Remove
                      </Action>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={addAdminAction} className="mt-6 flex flex-wrap items-end gap-3">
          <label className="block flex-1">
            <span className="field-label">Add an admin by email</span>
            <input className="field-input" type="email" name="email" required maxLength={254} />
          </label>
          <label className="block">
            <span className="field-label">Role</span>
            <select name="role" className="field-input" defaultValue="admin">
              <option value="admin">Admin</option>
              <option value="owner">Owner (can manage the team)</option>
            </select>
          </label>
          <button type="submit" className="btn-primary px-5 py-2 text-sm">
            Add and email a link
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-lg font-extrabold text-cream">Shared admin password</h2>
        <p className="mt-2 text-sm text-cream">
          {shared
            ? "The old shared password (ADMIN_PASSWORD) still opens the admin. Turn it off once everyone has their own account."
            : "The shared password is off: it no longer opens the admin, even though ADMIN_PASSWORD is still set."}
        </p>
        <form action={setSharedPasswordAction} className="mt-4">
          <input type="hidden" name="on" value={String(!shared)} />
          <button type="submit" className={shared ? "btn-primary px-5 py-2 text-sm" : "btn-secondary"}>
            {shared ? "Turn off the shared password" : "Turn the shared password back on"}
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-lg font-extrabold text-cream">Recent changes</h2>
        {log.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {log.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-3 py-2">
                <span className="text-muted">{when(e.at)}</span>
                <span className="text-cream">{e.admin_email}</span>
                <span className="text-cream">
                  {e.action}
                  {e.detail && <span className="text-muted">: {e.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Action({
  action,
  id,
  name,
  value,
  className,
  children,
}: {
  action: (form: FormData) => Promise<void>;
  id: string;
  name?: string;
  value?: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {name && <input type="hidden" name={name} value={value} />}
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
