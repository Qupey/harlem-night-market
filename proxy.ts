import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorization } from "./lib/admin-auth";

// Password-protects the admin pages and exports with HTTP Basic Auth.
// Set ADMIN_PASSWORD in .env.local (and in your host's settings when deployed).
// This is a stopgap until Supabase Auth admin logins are added.
export async function proxy(request: NextRequest) {
  // Browsers resend the saved admin password on every request, even ones another website
  // triggers, so changes must come from this site's own pages.
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !fromThisSite(request)) {
    return new NextResponse("Cross-site request blocked", { status: 403 });
  }

  if (!process.env.ADMIN_PASSWORD) {
    return new NextResponse("Admin is disabled. Set ADMIN_PASSWORD to enable it.", { status: 503 });
  }

  const header = request.headers.get("authorization");
  if (isAdminAuthorization(header)) return NextResponse.next();

  // Slows down password guessing. The real limit is a Vercel Firewall rate-limit rule.
  if (header) await new Promise((resolve) => setTimeout(resolve, 750));
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
