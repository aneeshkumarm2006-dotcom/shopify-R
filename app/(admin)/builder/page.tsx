import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProducts, getStore, getThemeConfig } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { StoreBuilder } from "@/components/builder";

export const metadata: Metadata = { title: "Store builder" };

/**
 * Store builder route (Stage 4 · DESIGN §4.9). Renders chromeless (see `AdminChrome`
 * BARE_PREFIXES) as a full-screen 3-panel editor. Fetches the store, its `themeConfig`,
 * and products from the data seams and hands them to the client `StoreBuilder`,
 * which edits a local copy of the config and previews it through the shared
 * `StoreRenderer`.
 */
export default async function BuilderPage() {
  const storeId = await requireMerchantStoreId();
  const [store, config, products] = await Promise.all([
    getStore(storeId),
    getThemeConfig(storeId),
    getProducts(storeId),
  ]);
  if (!store || !config) notFound();

  return (
    <StoreBuilder
      storeId={storeId}
      storeName={store.name}
      currency={store.settings.currency}
      config={config}
      products={products}
    />
  );
}
