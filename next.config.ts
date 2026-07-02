import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every response. These are the headers that are
 * safe regardless of the merchant code-injection feature: they don't restrict scripts,
 * so they can't break a merchant's intentional storefront JS. A script-restricting
 * `Content-Security-Policy` (script-src/default-src) is deliberately NOT set here yet —
 * it can only be tightened once storefront code injection is confined to an isolated
 * origin (see the code-injection origin-isolation hardening). Until then we still set
 * `frame-ancestors` (clickjacking) via CSP, plus the transport/sniff/referrer headers.
 *
 * `frame-ancestors 'self'` (and X-Frame-Options SAMEORIGIN) keeps the builder's
 * same-origin storefront preview iframe working while blocking cross-origin framing of
 * the admin dashboard.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework/version to attackers.
  poweredByHeader: false,
  images: {
    // Cloudinary is wired in Stage 9; allowlist its delivery host ahead of time.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  // Mongoose (Stage 6) uses dynamic requires; keep it external to the server
  // bundle so Next doesn't try to trace/bundle it and emit "Critical dependency"
  // warnings. It runs only in the Node.js runtime via the data-access layer.
  serverExternalPackages: ["mongoose"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
