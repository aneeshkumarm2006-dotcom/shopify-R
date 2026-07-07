import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollection, getCollectionProducts, getThemeConfig, getProducts } from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";
import { buildStoreMetadata } from "@/lib/seo";
import { CollectionView, StoreFrame } from "@/components/storefront";
import { StoreRenderer } from "@/components/sections";

/**
 * Collection listing page (DESIGN §5.4). Resolves the tenant by subdomain (Stage 8),
 * the collection by handle, and its (manually grouped) products, then renders the
 * product grid inside the store chrome.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const store = await resolveStorefront();
  if (!store) return {};
  const collection = await getCollection(store._id, handle);
  if (!collection) return {};
  return buildStoreMetadata(store, { title: `${collection.title} — ${store.name}` });
}

export default async function StoreCollectionPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const store = await resolveStorefront();
  if (!store) notFound();
  const storeId = store._id;

  const [config, collection, products] = await Promise.all([
    getThemeConfig(storeId),
    getCollection(storeId, handle),
    getCollectionProducts(storeId, handle),
  ]);
  if (!config || !collection) notFound();

  // The storefront only surfaces active products — draft products stay hidden from
  // customers (Stage 8 enforces draft/live gating store-wide).
  const visible = products.filter((p) => p.status === "active");

  // Merchant-added "Collection" template sections (Stage 4 builder) render below the
  // product grid on every collection page — only fetch the wider active catalog when
  // there's actually a product-bearing section to resolve against.
  const hasCollectionSections = (config.templates.collection?.sectionOrder?.length ?? 0) > 0;
  const catalog = hasCollectionSections ? await getProducts(storeId, { status: "active" }) : [];

  return (
    <StoreFrame config={config} storeName={store.name}>
      <CollectionView collection={collection} products={visible} currency={store.settings.currency} />
      {hasCollectionSections && (
        <StoreRenderer
          storeId={storeId}
          config={config}
          template="collection"
          products={catalog}
          currency={store.settings.currency}
          storeName={store.name}
          chrome={false}
        />
      )}
    </StoreFrame>
  );
}
