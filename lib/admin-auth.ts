// Shared admin password check (HTTP Basic Auth against ADMIN_PASSWORD).
// Used by proxy.ts for the admin pages, and re-checked inside admin Server
// Actions so they can't be called from anywhere else.

export function isAdminAuthorization(header: string | null): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !header?.startsWith("Basic ")) return false;
  const decoded = atob(header.slice(6));
  const supplied = decoded.slice(decoded.indexOf(":") + 1);
  return timingSafeEqual(supplied, password);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
