import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getThemeConfig } from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";
import { ConfirmationView, StoreFrame } from "@/components/storefront";

/**
 * Order confirmation page (DESIGN §5.4) — success state with the order number,
 * summary echo, and "what happens next" copy (payment is offline in MVP). Footer is
 * hidden to match the calm, focused post-checkout flow.
 */
export const metadata: Metadata = { title: "Order confirmed" };

export default async function StoreOrderConfirmationPage() {
  const store = await resolveStorefront();
  if (!store) notFound();
  const config = await getThemeConfig(store._id);
  if (!config) notFound();

  return (
    <StoreFrame config={config} storeName={store.name} footer={false}>
      <ConfirmationView />
    </StoreFrame>
  );
}
