import { connection } from "next/server";
import { Suspense } from "react";
import { currentAdmin, loginsAvailable } from "@/lib/admin-auth";
import { logoutAction } from "./login/actions";

// A strip above every admin page showing who is signed in.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <Suspense fallback={null}>
        <SignedInBar />
      </Suspense>
      {children}
    </>
  );
}

async function SignedInBar() {
  await connection();
  const admin = await currentAdmin();
  if (!admin || !(await loginsAvailable())) return null; // nothing new until admin logins are set up
  return (
    <div className="border-b border-line">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-end gap-x-4 gap-y-1 px-4 py-2 text-sm text-muted sm:px-6">
        {admin.via === "shared" ? (
          <span>
            Signed in with the shared password ·{" "}
            <a href="/admin/login" className="underline">
              Sign in with your own account
            </a>
          </span>
        ) : (
          <>
            <span>
              Signed in as <strong className="text-cream">{admin.email}</strong>
              {admin.role === "owner" && " (owner)"}
            </span>
            {admin.role === "owner" && (
              <a href="/admin/team" className="underline">
                Team
              </a>
            )}
            <form action={logoutAction}>
              <button type="submit" className="underline">
                Log out
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
