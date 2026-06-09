import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProducts, getThemeConfig } from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";
import { buildStoreMetadata } from "@/lib/seo";
import { StoreRenderer } from "@/components/sections";

/**
 * Static page (DESIGN §5.4) — rendered from the `page` template (rich_text-driven),
 * for policies / compliance / about. Uses the shared `StoreRenderer` with chrome, so
 * a content page is just another template composition. Per-handle page content is a
 * Stage 11 concern; for now we serve the single `page` template the themeConfig carries.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const store = await resolveStorefront();
  const pageTitle = handle.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (!store) return { title: pageTitle };
  return buildStoreMetadata(store, { title: `${pageTitle} — ${store.name}` });
}

export default async function StoreStaticPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  await params; // handle reserved for per-page content lookup in Stage 11
  const store = await resolveStorefront();
  if (!store) notFound();
  const storeId = store._id;

  const [config, products] = await Promise.all([
    getThemeConfig(storeId),
    getProducts(storeId, { status: "active" }),
  ]);
  if (!config) notFound();

  return (
    <StoreRenderer
      storeId={storeId}
      config={config}
      template="page"
      products={products}
      currency={store.settings.currency}
      storeName={store.name}
    />
  );
}
