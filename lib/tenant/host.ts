/**
 * Tenant host parsing — intentionally PURE and EDGE-SAFE (no DB, no Mongoose, no
 * Node APIs). Imported by `middleware.ts` (Edge runtime), the storefront server
 * resolver, the per-store `sitemap.xml` / `robots.txt` route handlers, and the
 * onboarding subdomain validators. Everything here is host-string math + constants.
 *
 * `<subdomain>.<APP_DOMAIN>` resolves to a tenant store; the apex domain, `www`, and
 * the reserved labels below resolve to the platform app (marketing + admin). Local
 * development is supported via `<subdomain>.localhost:<port>` (browsers route
 * `*.localhost` to 127.0.0.1), so the multi-tenant flow is testable without DNS.
 */

/** Apex domain for wildcard store subdomains: `<subdomain>.APP_DOMAIN` (PRD §8). */
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "ourapp.com";

/**
 * Request header the middleware stamps with the resolved tenant subdomain so the
 * `(store)` server components can look the store up. Read via `next/headers`.
 */
export const STORE_SUBDOMAIN_HEADER = "x-store-subdomain";

/** Reserved subdomains that bypass to the app shell, never a tenant (PRD §9). */
export const RESERVED_SUBDOMAINS = [
  "admin",
  "app",
  "www",
  "api",
  "platform",
  "dashboard",
  "static",
  "assets",
  "cdn",
  "mail",
  "status",
];

/** DNS-safe label: lowercase alphanumerics + hyphens, 1–63 chars, no edge hyphen. */
export function isDnsSafeSubdomain(value: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(value);
}

/**
 * Resolve a request `Host` header to a tenant store subdomain, or `null` when the
 * host is the apex domain, a reserved label (`www`, `admin`, …), or anything that
 * isn't a `<sub>.<APP_DOMAIN>` / `<sub>.localhost` address. A `null` result means
 * "serve the platform app, not a storefront".
 */
export function parseStoreSubdomain(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = (host.split(":")[0] ?? host).toLowerCase(); // strip any :port

  // The store label is whatever sits in front of a recognized root domain.
  let label: string | null = null;
  for (const root of [APP_DOMAIN, "localhost"]) {
    if (hostname === root) return null; // apex itself → app
    if (hostname.endsWith(`.${root}`)) {
      label = hostname.slice(0, -(`.${root}`.length));
      break;
    }
  }
  if (!label) return null; // unrelated host (e.g. *.vercel.app) → app

  // Only the leftmost label identifies the store; ignore any deeper nesting.
  const sub = label.split(".")[0] ?? "";
  if (!sub || RESERVED_SUBDOMAINS.includes(sub) || !isDnsSafeSubdomain(sub)) return null;
  return sub;
}

/**
 * Build the public origin (`scheme://host`) for the current request, trusting the
 * `Host` header so per-store `robots.txt` / `sitemap.xml` URLs carry the tenant's own
 * subdomain (Next's `nextUrl.origin` reflects the server bind host, not the Host).
 * Honors `x-forwarded-proto` behind Vercel/proxies, defaulting to `https`.
 */
export function originFromRequest(req: {
  headers: { get(name: string): string | null };
}): string {
  const host = req.headers.get("host") ?? APP_DOMAIN;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
