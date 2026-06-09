import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getThemeConfig } from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";
import { CartPage, StoreFrame } from "@/components/storefront";

/**
 * Cart page (DESIGN §5.4) — the routed full-page cart, sharing the session cart with
 * the quick cart sheet (Stage 1). Lines + subtotal + checkout CTA, designed empty state.
 */
export const metadata: Metadata = { title: "Cart" };

export default async function StoreCartPage() {
  const store = await resolveStorefront();
  if (!store) notFound();
  const config = await getThemeConfig(store._id);
  if (!config) notFound();

  return (
    <StoreFrame config={config} storeName={store.name}>
      <CartPage />
    </StoreFrame>
  );
}
