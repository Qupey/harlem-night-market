import { NextResponse, type NextRequest } from "next/server";
import { authenticate, loginsAvailable, sessionCookie, sharedPasswordEnabled } from "./lib/admin-auth";

// Protects the admin pages and API. Admins sign in at /admin/login with their own account; the
// old shared ADMIN_PASSWORD (HTTP Basic Auth) also works until an owner turns it off, and is the
// only way in until supabase/add-admin-logins.sql has been run.
const PUBLIC_PAGES = ["/admin/login", "/admin/set-password"];

export async function proxy(request: NextRequest) {
  // Browsers resend admin credentials on every request, even ones another website
  // triggers, so changes must come from this site's own pages.
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !fromThisSite(request)) {
    return new NextResponse("Cross-site request blocked", { status: 403 });
  }

  const { pathname, searchParams } = request.nextUrl;
  if (PUBLIC_PAGES.includes(pathname)) return NextResponse.next();

  const found = await authenticate(request.headers);
  if (found) {
    const response = NextResponse.next();
    if (found.slid && found.token) response.cookies.set(sessionCookie(found.token)); // 7 days from now
    return response;
  }

  const logins = await loginsAvailable();
  if (!logins && !process.env.ADMIN_PASSWORD) {
    return new NextResponse("Admin is disabled. Set ADMIN_PASSWORD to enable it.", { status: 503 });
  }

  // Slows down password guessing. Sign-in forms have their own lockout.
  if (request.headers.get("authorization")) await new Promise((resolve) => setTimeout(resolve, 750));

  const shared = !!process.env.ADMIN_PASSWORD && (await sharedPasswordEnabled());
  // Pages go to the sign-in form, unless the visitor chose the shared password there (?basic).
  if (logins && !pathname.startsWith("/api/") && !(shared && searchParams.has("basic"))) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (!shared) return new NextResponse("Sign in at /admin/login", { status: 401 });
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Night Market Admin", charset="UTF-8"' },
  });
}

function fromThisSite(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true; // requests that don't come from a web page carry no Origin
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const allowed = [request.headers.get("host"), request.nextUrl.host];
  try {
    if (process.env.SITE_URL) allowed.push(new URL(process.env.SITE_URL).host);
  } catch {
    // ignore a malformed SITE_URL
  }
  return allowed.includes(host);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
