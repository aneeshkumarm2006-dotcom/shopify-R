import { notFound } from "next/navigation";
import {
  getCustomers,
  getLowStock,
  getOrders,
  getProducts,
  getStore,
  getStoreOwner,
  getSubscription,
} from "@/lib/data";
import { getMerchantContext } from "@/lib/auth";
import { AdminChrome } from "@/components/admin/admin-chrome";

/**
 * Admin route-group layout (DESIGN §4.1). Resolves the *signed-in* merchant's
 * store (Stage 7) and renders the app chrome (sidebar + topbar + ⌘K). When there
 * is no usable session yet — anonymous, or signed-in but still mid-onboarding —
 * it renders the child bare, so `/sign-in` and `/onboarding` show without chrome
 * and without redirect-looping. Protected pages enforce auth themselves via
 * `requireMerchantStoreId()`. With auth unconfigured this falls back to the demo
 * store, so Part A keeps working on mock data.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getMerchantContext();

  // Anonymous or onboarding-in-progress → no chrome; the auth screens render here.
  if (!ctx || !ctx.ready) return <>{children}</>;

  const storeId = ctx.storeId;
  const [store, owner, subscription, products, orders, customers, lowStock] = await Promise.all([
    getStore(storeId),
    getStoreOwner(storeId),
    getSubscription(storeId),
    getProducts(storeId),
    getOrders(storeId),
    getCustomers(storeId),
    getLowStock(storeId),
  ]);

  if (!store || !owner || !subscription) notFound();

  const unfulfilledCount = orders.filter((o) => o.fulfillmentStatus === "unfulfilled").length;
  const lowCount = lowStock.filter((r) => r.status === "low").length;
  const outCount = lowStock.filter((r) => r.status === "out").length;

  return (
    <AdminChrome
      store={store}
      owner={owner}
      subscription={subscription}
      products={products}
      orders={orders}
      customers={customers}
      unfulfilledCount={unfulfilledCount}
      lowCount={lowCount}
      outCount={outCount}
    >
      {children}
    </AdminChrome>
  );
}
