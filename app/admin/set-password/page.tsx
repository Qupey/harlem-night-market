import { connection } from "next/server";
import { Suspense } from "react";
import { linkTokenUser, MIN_PASSWORD_LENGTH } from "@/lib/admin-auth";
import { setPasswordAction } from "../login/actions";
import { Notice, PasswordField } from "../login/ui";

export const metadata = { title: "Set your admin password | Harlem Night Market", robots: { index: false } };

// Where invite and reset emails link to. The link's token is used up when the form is saved.
export default function SetPasswordPage({ searchParams }: PageProps<"/admin/set-password">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:px-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-gold">Harlem Night Market admin</p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading...</p>}>
        <SetPasswordForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SetPasswordForm({ searchParams }: Pick<PageProps<"/admin/set-password">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const user = token ? await linkTokenUser(token) : undefined;
  if (!user) {
    return (
      <>
        <h1 className="mt-2 display text-4xl text-orange">This link has expired</h1>
        <p className="mt-4 text-cream">Links work once, for 24 hours. You can ask for a new one.</p>
        <a href="/admin/login?forgot" className="btn-primary mt-6 inline-block px-5 py-2">
          Email me a new link
        </a>
      </>
    );
  }
  return (
    <>
      <h1 className="mt-2 display text-4xl text-orange">{user.password_hash ? "Choose a new password" : "Set your password"}</h1>
      <p className="mt-4 text-sm text-cream">
        For <strong>{user.email}</strong>. At least {MIN_PASSWORD_LENGTH} characters; a few unrelated words make a good one.
      </p>
      <Notice code={typeof params.m === "string" ? params.m : undefined} />
      <form action={setPasswordAction} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />
        <input type="text" name="email" value={user.email} autoComplete="username" readOnly hidden />
        <PasswordField label="New password" name="password" autoComplete="new-password" />
        <PasswordField label="New password again" name="confirm" autoComplete="new-password" />
        <button type="submit" className="btn-primary px-5 py-2">
          Save and sign in
        </button>
      </form>
    </>
  );
}
