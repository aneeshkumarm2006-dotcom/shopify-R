import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProductByHandle,
  getThemeConfig,
  getProductReviews,
  getRatingSummary,
  getRelatedProducts,
} from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";
import { buildStoreMetadata } from "@/lib/seo";
import { ProductView, StoreFrame } from "@/components/storefront";

/**
 * Product detail page (DESIGN §5.4). Resolves the tenant by subdomain (Stage 8), then
 * the product by its per-store handle, 404s when missing, and renders the buy box
 * inside the shared store chrome. Per-page SEO uses the product's overrides, falling
 * back to the store defaults (PRD §6.3).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const store = await resolveStorefront();
  if (!store) return {};
  const product = await getProductByHandle(store._id, handle);
  if (!product) return {};
  // Per-product SEO overrides win; the OG image falls back to the product's first
  // image, then the store default (PRD §6.3).
  return buildStoreMetadata(store, {
    title: product.seo.title || product.title,
    description: product.seo.description,
    ogImage: product.images[0],
  });
}

export default async function StoreProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const store = await resolveStorefront();
  if (!store) notFound();
  const storeId = store._id;

  const [config, product] = await Promise.all([
    getThemeConfig(storeId),
    getProductByHandle(storeId, handle),
  ]);
  // Draft products stay hidden from customers (Stage 8 store-wide gating).
  if (!config || !product || product.status !== "active") notFound();

  // Reviews + related rail (Phase 4) — fetched in parallel after the product resolves.
  const [reviews, ratingSummary, related] = await Promise.all([
    getProductReviews(storeId, product._id),
    getRatingSummary(storeId, product._id),
    getRelatedProducts(storeId, product, 4),
  ]);

  return (
    <StoreFrame config={config} storeName={store.name}>
      <ProductView
        product={product}
        currency={store.settings.currency}
        reviews={reviews}
        ratingSummary={ratingSummary}
        related={related}
      />
    </StoreFrame>
  );
}
