import { type NextRequest } from "next/server";
import { parseStoreSubdomain, originFromRequest } from "@/lib/tenant/host";
import { getStoreBySubdomain, getProducts, getCollections, getStoreIdByVerifiedDomain, getStore } from "@/lib/data";
import type { Store } from "@/types";

/**
 * Per-store `sitemap.xml` (Stage 8, PRD §6.3). The middleware skips dot-named routes,
 * so this handler reads the `Host` itself to resolve the tenant, then lists the live
 * store's crawlable URLs: home, each manual collection, and each active product.
 * Draft/suspended/unknown stores return an empty (but valid) urlset — they don't serve
 * a storefront, so they expose no URLs.
 */
export const dynamic = "force-dynamic";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

  const paths: string[] = [];
  if (store && store.status === "live") {
    const [products, collections] = await Promise.all([
      getProducts(store._id, { status: "active" }),
      getCollections(store._id),
    ]);
    paths.push("/");
    for (const c of collections) paths.push(`/collections/${c.handle}`);
    for (const p of products) paths.push(`/products/${p.handle}`);
  }

  const urls = paths
    .map((path) => `  <url>\n    <loc>${xmlEscape(origin + path)}</loc>\n  </url>`)
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
