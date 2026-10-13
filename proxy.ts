import { NextResponse, type NextRequest } from "next/server";

// Password-protects the admin pages and exports with HTTP Basic Auth.
// Set ADMIN_PASSWORD in .env.local (and in your host's settings when deployed).
// This is a stopgap until Supabase Auth admin logins are added.
export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return new NextResponse("Admin is disabled. Set ADMIN_PASSWORD to enable it.", { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const supplied = decoded.slice(decoded.indexOf(":") + 1);
    if (timingSafeEqual(supplied, password)) return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Night Market Admin", charset="UTF-8"' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
