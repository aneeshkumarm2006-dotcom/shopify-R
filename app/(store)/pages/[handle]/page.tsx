import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getThemeConfig, getProducts, getPageByHandle } from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";
import { buildStoreMetadata } from "@/lib/seo";
import { StoreFrame } from "@/components/storefront";
import { StoreRenderer } from "@/components/sections";
import { sanitizeHtmlFragment } from "@/lib/sanitize/inject";

/**
 * Content page (About / Contact / FAQ / policies). Each page is now its OWN record
 * resolved by handle — previously this route ignored its handle and rendered one
 * shared generic template for every URL, so every page looked identical. The page's
 * own title + body render inside the store chrome; the themeConfig "page" template's
 * sections (if any) render around it as supplementary content, mirroring how the
 * product/collection templates layer onto those pages.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const store = await resolveStorefront();
  if (!store) return {};
  const page = await getPageByHandle(store._id, handle);
  if (!page) return {};
  return buildStoreMetadata(store, {
    title: page.seo?.title || `${page.title} — ${store.name}`,
    description: page.seo?.description,
  });
}

export default async function StoreStaticPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const store = await resolveStorefront();
  if (!store) notFound();
  const storeId = store._id;

  const [config, page] = await Promise.all([
    getThemeConfig(storeId),
    getPageByHandle(storeId, handle),
  ]);
  if (!config || !page) notFound();

  // Only pull the catalog when the shared "page" template actually has product-bearing
  // sections to resolve against (kept lazy like product/collection templates).
  const hasPageSections = (config.templates.page?.sectionOrder?.length ?? 0) > 0;
  const catalog = hasPageSections ? await getProducts(storeId, { status: "active" }) : [];

  return (
    <StoreFrame config={config} storeName={store.name}>
      <article className="store-container store-page">
        <h1 className="store-page-title">{page.title}</h1>
        <div
          className="store-page-body"
          dangerouslySetInnerHTML={{ __html: sanitizeHtmlFragment(page.body) }}
        />
      </article>
      {hasPageSections && (
        <StoreRenderer
          storeId={storeId}
          config={config}
          template="page"
          products={catalog}
          currency={store.settings.currency}
          storeName={store.name}
          chrome={false}
        />
      )}
    </StoreFrame>
  );
}
