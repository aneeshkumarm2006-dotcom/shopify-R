import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getThemeConfig, getOrdersForCustomer, toPublicCustomer } from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";
import { getCurrentCustomer } from "@/lib/customer/session";
import { storeCurrency } from "@/lib/format";
import { StoreFrame } from "@/components/storefront";
import { AccountView, type AccountOrderSummary } from "@/components/storefront/account-view";

/**
 * Storefront account page (Phase 3). Renders the signed-in dashboard (profile, order
 * history, saved addresses) when a customer cookie resolves, or the login/register
 * view when anonymous — all behind the same tenant-scoped storefront chrome. The
 * customer session is the separate signed cookie, distinct from merchant auth.
 */
export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const store = await resolveStorefront();
  if (!store) notFound();

  const config = await getThemeConfig(store._id);
  if (!config) notFound();

  const customer = await getCurrentCustomer(store);
  const orders = customer ? await getOrdersForCustomer(store._id, customer._id) : [];
  const orderSummaries: AccountOrderSummary[] = orders.map((o) => ({
    id: o._id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    total: o.total,
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    itemCount: o.lineItems.reduce((s, l) => s + l.quantity, 0),
  }));

  return (
    <StoreFrame config={config} storeName={store.name}>
      <AccountView
        customer={customer ? toPublicCustomer(customer) : null}
        orders={orderSummaries}
        currency={storeCurrency(store.settings)}
      />
    </StoreFrame>
  );
}
