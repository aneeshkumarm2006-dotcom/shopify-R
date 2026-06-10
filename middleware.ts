import { NextResponse, type NextRequest } from "next/server";
import {
  isDnsSafeSubdomain,
  RESERVED_SUBDOMAINS,
  STORE_SUBDOMAIN_HEADER,
} from "@/lib/tenant/host";

/**
 * Multi-tenant PATH routing (PRD §2.2 / §6.3).
 *
 * Stores are served under a `/s/<subdomain>` path prefix rather than a wildcard
 * subdomain, so the whole platform runs on a single host (e.g. a `*.vercel.app`
 * deployment, where wildcard subdomains aren't available). For a storefront request:
 *  - `/s/<subdomain>`            → rewrite to the `(store)` home (`/preview`)
 *  - `/s/<subdomain>/<rest...>`  → rewrite to the `(store)` route `/<rest...>`
 * and the resolved subdomain is stamped onto the request headers (read server-side by
 * `resolveStorefront()`). The customer's URL keeps the `/s/<subdomain>` prefix; the
 * internal route tree (shared with `(admin)` at the root) is untouched.
 *
 * Anything not under `/s/` (the marketing apex `/`, the `(admin)` dashboard, etc.)
 * passes straight through to the platform app.
 *
 * Runs on the Edge runtime: it only does path-string math + header passing — the
 * actual store lookup + live/draft/suspended gating happen in the Node-runtime
 * `(store)` server components, which can reach MongoDB.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only storefront paths are namespaced under `/s/`; everything else is the app.
  if (pathname !== "/s" && !pathname.startsWith("/s/")) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean); // ["s", "<sub>", ...rest]
  const sub = segments[1];

  // No / invalid / reserved subdomain → let it fall through (and 404 normally).
  if (!sub || RESERVED_SUBDOMAINS.includes(sub) || !isDnsSafeSubdomain(sub)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(STORE_SUBDOMAIN_HEADER, sub);

  const rest = segments.slice(2).join("/"); // "products/x", "cart", or ""
  const url = req.nextUrl.clone();
  // Bare `/s/<sub>` is the storefront home (the `(store)` group's `/preview` route).
  url.pathname = rest ? `/${rest}` : "/preview";
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  // Run on everything except Next internals, the auth/API routes, and files with an
  // extension (favicon, images, etc.).
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
