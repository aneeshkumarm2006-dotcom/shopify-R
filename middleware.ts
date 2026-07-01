import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@vercel/edge-config";
import {
  APP_DOMAIN,
  edgeConfigDomainKey,
  isDnsSafeSubdomain,
  RESERVED_SUBDOMAINS,
  STORE_SUBDOMAIN_HEADER,
  STORE_BASE_PATH_HEADER,
  type EdgeDomainEntry,
} from "@/lib/tenant/host";

/**
 * Multi-tenant routing (PRD §2.2 / §6.3 + per-store custom domains, Phase 3).
 *
 * Two independent ways a request resolves to a store, both ending in the same
 * `x-store-subdomain` header (read server-side by `resolveStorefront()` — everything
 * downstream of this file stays unaware domains exist):
 *
 * 1. PATH routing — stores served under a `/s/<subdomain>` path prefix, so the whole
 *    platform runs on a single host (e.g. a `*.vercel.app` deployment, where wildcard
 *    subdomains aren't available):
 *      - `/s/<subdomain>`            → rewrite to the `(store)` home (`/preview`)
 *      - `/s/<subdomain>/<rest...>`  → rewrite to the `(store)` route `/<rest...>`
 *    The customer's URL keeps the `/s/<subdomain>` prefix; the internal route tree
 *    (shared with `(admin)` at the root) is untouched.
 *
 * 2. HOST routing (custom domains) — a merchant's own verified domain (e.g.
 *    `shop.cooltshirts.com`) maps directly to a subdomain via the Edge Config
 *    routing cache (`lib/vercel/edge-config.ts` writes it on verification). For these
 *    requests the pathname is ALREADY the "real" path (no `/s/<sub>` prefix to
 *    strip) — only the bare-home case (`/`) needs rewriting, to `/preview`, mirroring
 *    the path-routing case above.
 *
 * Resolution order per request: path-routing first (`/s/...`, unchanged from before
 * this phase); only if the path ISN'T under `/s/` do we check whether the request's
 * Host is a known custom domain. Most traffic (marketing apex, `*.vercel.app`
 * preview/prod hosts, `(admin)` dashboard) is on OUR OWN known host patterns, not a
 * merchant's custom domain — `parseStoreSubdomain`-shaped checks short-circuit those
 * before ever touching Edge Config, so the network call only happens for hosts that
 * could plausibly be a verified custom domain.
 *
 * Edge Config reads are a soft dependency: wrapped in try/catch, with NextResponse
 * .next() (→ falls through to the marketing/admin app) on any miss, error, or
 * timeout. A slow/erroring Edge Config must never 500 a request or block traffic.
 *
 * Runs on the Edge runtime: only path/host string math, header passing, and a single
 * targeted Edge Config key read — no MongoDB. The actual store lookup + live/draft/
 * suspended gating happen in the Node-runtime `(store)` server components.
 */
export function middleware(req: NextRequest): NextResponse | Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // --- 1. Path routing: `/s/<subdomain>/...` (unchanged) ---
  if (pathname === "/s" || pathname.startsWith("/s/")) {
    const segments = pathname.split("/").filter(Boolean); // ["s", "<sub>", ...rest]
    const sub = segments[1];

    // No / invalid / reserved subdomain → let it fall through (and 404 normally).
    if (!sub || RESERVED_SUBDOMAINS.includes(sub) || !isDnsSafeSubdomain(sub)) {
      return NextResponse.next();
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(STORE_SUBDOMAIN_HEADER, sub);
    // Path-routed: storefront links must keep the /s/<sub> prefix so navigation stays
    // on the same host+path. Custom-domain branch sets this to "" instead.
    requestHeaders.set(STORE_BASE_PATH_HEADER, `/s/${sub}`);

    const rest = segments.slice(2).join("/"); // "products/x", "cart", or ""
    const url = req.nextUrl.clone();
    // Bare `/s/<sub>` is the storefront home (the `(store)` group's `/preview` route).
    url.pathname = rest ? `/${rest}` : "/preview";
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // --- 2. Host routing: verified custom domains ---
  return resolveCustomDomainRequest(req);
}

/** Cheap, allocation-free check for hosts that are obviously OURS (platform apex,
 * `www`, any `<reserved-or-store>.<APP_DOMAIN>`, `*.localhost`, `*.vercel.app`) —
 * none of these can ever be a merchant's verified custom domain, so checking them
 * against Edge Config would be a wasted network call on the hottest paths
 * (marketing site, admin dashboard, our own `/s/` preview hosts). Pure string
 * matching, no I/O. */
function isKnownPlatformHost(hostname: string): boolean {
  if (hostname === APP_DOMAIN || hostname.endsWith(`.${APP_DOMAIN}`)) return true;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (hostname.endsWith(".vercel.app")) return true;
  return false;
}

/** Host-routing branch: only reached for paths NOT under `/s/`. Looks up the
 * request's Host against the Edge Config custom-domain map; on a hit, rewrites +
 * stamps the header exactly like the path-routing branch. Any miss/short-circuit/
 * error falls through to `NextResponse.next()` so the platform app keeps serving
 * marketing + admin traffic untouched. */
function resolveCustomDomainRequest(req: NextRequest): NextResponse | Promise<NextResponse> {
  const hostHeader = req.headers.get("host");
  const hostname = (hostHeader?.split(":")[0] ?? "").toLowerCase();

  // Short-circuit: skip the Edge Config round-trip entirely for hosts that can never
  // be a custom domain. This covers the overwhelming majority of non-`/s/` traffic.
  if (!hostname || isKnownPlatformHost(hostname)) {
    return NextResponse.next();
  }

  return resolveViaEdgeConfig(hostname, req);
}

async function resolveViaEdgeConfig(hostname: string, req: NextRequest): Promise<NextResponse> {
  let subdomain: string | null = null;
  try {
    const client = createClient(process.env.EDGE_CONFIG);
    // Entry is stored under a hashed key (Edge Config keys can't hold dots / >32 chars).
    // The stored `h` (hostname) is re-checked to make a hash collision a safe MISS
    // rather than a cross-tenant mis-route.
    const value = await client.get<EdgeDomainEntry>(edgeConfigDomainKey(hostname));
    if (value && typeof value === "object" && value.h === hostname && typeof value.s === "string") {
      subdomain = value.s;
    }
  } catch (err) {
    // Soft failure: a missing/misconfigured/slow Edge Config must never 500 the
    // request or block traffic on hosts that aren't custom domains.
    console.error("[middleware] Edge Config lookup failed (falling through)", { hostname, err });
    return NextResponse.next();
  }

  if (!subdomain || RESERVED_SUBDOMAINS.includes(subdomain) || !isDnsSafeSubdomain(subdomain)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(STORE_SUBDOMAIN_HEADER, subdomain);
  // Custom-domain: visitor is already at the domain root, so links must be root-relative
  // (no /s/<sub> prefix). Empty string signals the (store) layout to use bare paths.
  requestHeaders.set(STORE_BASE_PATH_HEADER, "");

  const url = req.nextUrl.clone();
  // A custom-domain visitor's pathname IS already the real path — no `/s/<sub>`
  // prefix to strip — except the bare home, which still needs the explicit
  // `/preview` route (mirroring the path-routing branch's bare-home case).
  url.pathname = url.pathname === "/" ? "/preview" : url.pathname;
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  // Run on everything except Next internals, the auth/API routes, and files with an
  // extension (favicon, images, etc.).
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
