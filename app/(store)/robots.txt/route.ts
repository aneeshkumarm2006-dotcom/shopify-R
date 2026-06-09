import { type NextRequest } from "next/server";
import { parseStoreSubdomain, originFromRequest } from "@/lib/tenant/host";
import { getStoreBySubdomain } from "@/lib/data";

/**
 * Per-store `robots.txt` (Stage 8, PRD §6.3). The middleware skips dot-named routes,
 * so this handler reads the `Host` itself to resolve the tenant. A live store invites
 * crawling and points at its own `sitemap.xml`; anything else (apex, reserved label,
 * unknown / draft / suspended store) disallows crawling — nothing non-live should be
 * indexed.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const subdomain = parseStoreSubdomain(req.headers.get("host"));
  const store = subdomain ? await getStoreBySubdomain(subdomain) : null;
  const origin = originFromRequest(req);

  const body =
    store && store.status === "live"
      ? `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`
      : `User-agent: *\nDisallow: /\n`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
