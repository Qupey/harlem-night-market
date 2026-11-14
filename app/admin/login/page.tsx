import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentAdmin, hasAdminAccounts, loginsAvailable, MIN_PASSWORD_LENGTH, sharedPasswordEnabled } from "@/lib/admin-auth";
import { createFirstAdminAction, forgotPasswordAction, loginAction } from "./actions";
import { EmailField, Notice, PasswordField } from "./ui";

export const metadata = { title: "Admin sign in | Harlem Night Market", robots: { index: false } };

export default function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:px-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-gold">Harlem Night Market admin</p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading...</p>}>
        <LoginForms searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginForms({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const code = typeof params.m === "string" ? params.m : undefined;
  const admin = await currentAdmin();
  if (admin?.via === "session") redirect("/admin");
  const sharedLink = (await sharedPasswordEnabled()) && !!process.env.ADMIN_PASSWORD && (
    <p className="mt-8 text-sm text-muted">
      Or{" "}
      <a href="/admin?basic=1" className="underline">
        use the shared admin password
      </a>
      .
    </p>
  );

  if (!(await loginsAvailable())) {
    return (
      <>
        <h1 className="mt-2 display text-4xl text-orange">Admin sign in</h1>
        <p className="mt-4 text-cream">
          Individual admin logins aren&apos;t set up yet: run supabase/add-admin-logins.sql in the Supabase SQL Editor.
          Until then, use the shared admin password.
        </p>
        <a href="/admin?basic=1" className="btn-primary mt-6 inline-block px-5 py-2">
          Sign in with the shared password
        </a>
      </>
    );
  }

  if (!(await hasAdminAccounts())) {
    return (
      <>
        <h1 className="mt-2 display text-4xl text-orange">Create the first admin account</h1>
        <p className="mt-4 text-sm text-cream">
          No one has an admin account yet. Enter the current shared admin password to prove you&apos;re an admin, then
          choose your email and a new password. You&apos;ll be the owner and can add everyone else.
        </p>
        <Notice code={code} />
        <form action={createFirstAdminAction} className="mt-6 space-y-4">
          <PasswordField label="Current shared admin password" name="shared" autoComplete="off" />
          <EmailField />
          <PasswordField label={`New password (at least ${MIN_PASSWORD_LENGTH} characters)`} name="password" autoComplete="new-password" />
          <PasswordField label="New password again" name="confirm" autoComplete="new-password" />
          <button type="submit" className="btn-primary px-5 py-2">
            Create my account
          </button>
        </form>
        {sharedLink}
      </>
    );
  }

  if (params.forgot !== undefined) {
    return (
      <>
        <h1 className="mt-2 display text-4xl text-orange">Forgot your password?</h1>
        <p className="mt-4 text-sm text-cream">We&apos;ll email you a link to choose a new one.</p>
        <form action={forgotPasswordAction} className="mt-6 space-y-4">
          <EmailField />
          <button type="submit" className="btn-primary px-5 py-2">
            Email me a link
          </button>
        </form>
        <p className="mt-6 text-sm">
          <a href="/admin/login" className="text-muted underline">
            ← Back to sign in
          </a>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="mt-2 display text-4xl text-orange">Admin sign in</h1>
      <Notice code={code} />
      <form action={loginAction} className="mt-6 space-y-4">
        <EmailField />
        <PasswordField label="Password" name="password" autoComplete="current-password" />
        <button type="submit" className="btn-primary px-5 py-2">
          Sign in
        </button>
      </form>
      <p className="mt-6 text-sm">
        <a href="/admin/login?forgot" className="text-muted underline">
          Forgot your password?
        </a>
      </p>
      {sharedLink}
    </>
  );
}
