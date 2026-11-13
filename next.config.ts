import type { NextConfig } from "next";

// Browser protections: no framing (clickjacking), no MIME sniffing, no camera/microphone/location,
// HTTPS only. Payment and admin pages send no Referer at all, so payment links never leak to other
// sites, and private pages are kept out of search engines.
const CSP = {
  key: "Content-Security-Policy",
  value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://checkout.stripe.com",
};
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];
const PRIVATE_HEADERS = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Vendor files set their own, stricter policy (see app/api/admin/files).
      { source: "/((?!api/admin/files/).*)", headers: [CSP] },
      { source: "/admin/:path*", headers: PRIVATE_HEADERS },
      { source: "/pay/:path*", headers: PRIVATE_HEADERS },
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
