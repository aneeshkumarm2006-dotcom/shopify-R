import { NextResponse, type NextRequest } from "next/server";
import { parseStoreSubdomain, STORE_SUBDOMAIN_HEADER } from "@/lib/tenant/host";

/**
 * Multi-tenant subdomain routing (Stage 8, PRD §2.2 / §6.3).
 *
 * Reads the request `Host`, resolves a tenant store subdomain, and:
 *  - apex / `www` / reserved labels / unrelated hosts → pass straight through to the
 *    platform app (marketing landing + `(admin)` dashboard).
 *  - `<store>.<APP_DOMAIN>` → stamp the resolved subdomain onto the request headers
 *    (read server-side by `resolveStorefront()`), and rewrite the bare home `/` into
 *    the `(store)` group's internal `/preview` route (the apex `/` belongs to the
 *    marketing group, so the storefront home can't live at `/` — the rewrite keeps the
 *    customer's URL clean at `/` while serving the store home).
 *
 * Runs on the Edge runtime: it only does host-string math + header passing — the
 * actual store lookup + live/draft/suspended gating happen in the Node-runtime
 * `(store)` server components, which can reach MongoDB.
 */
export function middleware(req: NextRequest) {
  const subdomain = parseStoreSubdomain(req.headers.get("host"));

  // No tenant subdomain → the platform app serves this request unchanged.
  if (!subdomain) return NextResponse.next();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(STORE_SUBDOMAIN_HEADER, subdomain);

  // Storefront home: rewrite `/` → `/preview` (the `(store)` group's home route).
  if (req.nextUrl.pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/preview";
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // Every other storefront path keeps its URL; just carry the resolved tenant header.
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Run on everything except Next internals, the auth/API routes, and files with an
  // extension (favicon, images, and the dot-named robots.txt / sitemap.xml route
  // handlers, which read the Host header directly).
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
