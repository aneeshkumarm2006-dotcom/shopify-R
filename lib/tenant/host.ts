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

/**
 * Request header the middleware stamps with the correct basePath for storefront links.
 * `/s/<subdomain>` for path-routed stores; `""` (empty string) for custom-domain stores
 * (where the visitor is already at the root — no prefix should be prepended to links).
 */
export const STORE_BASE_PATH_HEADER = "x-store-base-path";

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
 * Resolve a request `Host` header to a store subdomain via a pre-fetched custom-
 * domain map (`{ [lowercased hostname]: subdomain }`), e.g. as read from the Edge
 * Config routing cache. Pure — the actual Edge Config I/O happens in
 * `middleware.ts`; this just does the lookup/string-normalization so it stays
 * testable without mocking network calls. Returns `null` when there's no host or no
 * match (host isn't a verified custom domain we know about).
 */
export function resolveCustomDomainSubdomain(
  host: string | null | undefined,
  domainMap: Record<string, string>,
): string | null {
  if (!host) return null;
  const hostname = (host.split(":")[0] ?? host).toLowerCase();
  return domainMap[hostname] ?? null;
}

/**
 * FNV-1a 32-bit hash → base36. Deterministic, synchronous, and dependency-free, so
 * it runs identically in the Edge middleware (read) and the Node write path.
 */
function fnv1a32(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * The Edge Config KEY under which a custom domain's routing entry is stored.
 *
 * Edge Config keys accept only `[A-Za-z0-9_-]` and max 32 chars — so a raw hostname
 * (dots are invalid, and long domains blow the length cap) CANNOT be used directly;
 * writes keyed by the bare domain are silently rejected. We hash the hostname to a
 * short, always-valid, deterministic key instead. Hash collisions are made SAFE by
 * storing the real hostname inside the entry's VALUE and verifying it on read (a
 * collision then just misses, never mis-routes one tenant's domain to another).
 */
export function edgeConfigDomainKey(host: string): string {
  const hostname = (host.split(":")[0] ?? host).trim().toLowerCase();
  return `d_${fnv1a32(hostname)}`;
}

/** The VALUE shape stored at `edgeConfigDomainKey(host)`: the canonical hostname
 * (for collision-safe verification on read) and the store subdomain to route to. */
export interface EdgeDomainEntry {
  h: string; // canonical lowercased hostname
  s: string; // store subdomain
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
