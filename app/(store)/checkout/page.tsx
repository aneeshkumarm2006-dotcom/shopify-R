import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getThemeConfig, enabledSettlements } from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";
import { CheckoutView, StoreFrame } from "@/components/storefront";

/**
 * Checkout page (DESIGN §5.4) — contact + shipping form and a sticky order summary.
 * Payment is a placeholder only (no card fields). Footer is hidden for a focused flow.
 * "Place order" runs the Stage 10 `submitOrder` action: it creates the pending order,
 * matches/creates the customer, decrements inventory, and allocates the gap-free
 * per-store order number atomically server-side.
 */
export const metadata: Metadata = { title: "Checkout" };

export default async function StoreCheckoutPage() {
  const store = await resolveStorefront();
  if (!store) notFound();

  const config = await getThemeConfig(store._id);
  if (!config) notFound();

  return (
    <StoreFrame config={config} storeName={store.name} footer={false}>
      <CheckoutView
        settlements={enabledSettlements(store)}
        shippingSettings={store.settings.shipping}
        taxSettings={store.settings.tax}
      />
    </StoreFrame>
  );
}
