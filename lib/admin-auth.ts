import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// Shared admin password check (HTTP Basic Auth against ADMIN_PASSWORD).
// Used by proxy.ts for the admin pages, and re-checked inside admin Server
// Actions and API routes so they can't be called from anywhere else.

// Compares SHA-256 digests in constant time, so neither the contents nor the length leak.
export function safeEqual(a: string, b: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export function isAdminAuthorization(header: string | null): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false; // not valid base64
  }
  const supplied = decoded.slice(decoded.indexOf(":") + 1);
  return safeEqual(supplied, password);
}

// For admin API routes: null when the request carries the admin password, else the 401 to send.
export function adminOnly(request: Request): Response | null {
  if (isAdminAuthorization(request.headers.get("authorization"))) return null;
  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Night Market Admin", charset="UTF-8"' },
  });
}
