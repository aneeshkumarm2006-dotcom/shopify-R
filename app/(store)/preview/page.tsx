import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProducts, getThemeConfig } from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";
import { buildStoreMetadata } from "@/lib/seo";
import { StoreRenderer } from "@/components/sections";

/**
 * Storefront home (DESIGN §5.4) — composed entirely from the home template's sections
 * via the shared `StoreRenderer` against the store's `themeConfig`. Lives at the
 * internal `/preview` route because the apex `/` is the marketing group's; Stage 8's
 * `middleware.ts` rewrites a live store subdomain's `/` here, so the customer sees a
 * clean `/` URL while this composition serves the home.
 */
export async function generateMetadata(): Promise<Metadata> {
  const store = await resolveStorefront();
  if (!store) return {};
  return buildStoreMetadata(store);
}

export default async function StoreHomePage() {
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
      template="home"
      products={products}
      currency={store.settings.currency}
      storeName={store.name}
    />
  );
}
