import type { Metadata } from "next";
import {
  getDashboardStats,
  getLowStock,
  getOrders,
  getProducts,
  getStore,
} from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { Dashboard } from "@/components/admin/dashboard";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage() {
  const storeId = await requireMerchantStoreId();
  const [store, stats, orders, lowStock, activeProducts] = await Promise.all([
    getStore(storeId),
    getDashboardStats(storeId, "7d"),
    getOrders(storeId),
    getLowStock(storeId),
    getProducts(storeId, { status: "active" }),
  ]);
  if (!store) notFound();

  return (
    <Dashboard
      store={store}
      stats={stats}
      recentOrders={orders}
      lowStock={lowStock}
      activeProductCount={activeProducts.length}
    />
  );
}
