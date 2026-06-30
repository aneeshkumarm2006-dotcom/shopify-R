import { type NextRequest } from "next/server";
import { parseStoreSubdomain, originFromRequest } from "@/lib/tenant/host";
import { getStoreBySubdomain, getStoreIdByVerifiedDomain, getStore } from "@/lib/data";
import type { Store } from "@/types";

/**
 * Per-store `robots.txt` (Stage 8, PRD §6.3). The middleware skips dot-named routes,
 * so this handler reads the `Host` itself to resolve the tenant. A live store invites
 * crawling and points at its own `sitemap.xml`; anything else (apex, reserved label,
 * unknown / draft / suspended store) disallows crawling — nothing non-live should be
 * indexed.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host");
  const subdomain = parseStoreSubdomain(host);
  let store: Store | null = subdomain ? await getStoreBySubdomain(subdomain) : null;
  // Fallback: host didn't match our own domain pattern — check if it's a verified
  // custom domain that maps to one of our stores.
  if (!store) {
    const hostname = (host?.split(":")[0] ?? "").toLowerCase();
    const storeId = hostname ? await getStoreIdByVerifiedDomain(hostname) : null;
    if (storeId) store = await getStore(storeId);
  }
  const origin = originFromRequest(req);

  const body =
    store && store.status === "live"
      ? `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`
      : `User-agent: *\nDisallow: /\n`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
