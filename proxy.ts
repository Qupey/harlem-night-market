import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorization } from "./lib/admin-auth";

// Password-protects the admin pages and exports with HTTP Basic Auth.
// Set ADMIN_PASSWORD in .env.local (and in your host's settings when deployed).
// This is a stopgap until Supabase Auth admin logins are added.
export function proxy(request: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) {
    return new NextResponse("Admin is disabled. Set ADMIN_PASSWORD to enable it.", { status: 503 });
  }

  if (isAdminAuthorization(request.headers.get("authorization"))) return NextResponse.next();

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Night Market Admin", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
