import type { Metadata } from "next";
import { getOrders } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { OrdersIndex } from "@/components/admin/orders-index";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const orders = await getOrders(await requireMerchantStoreId());
  return <OrdersIndex orders={orders} />;
}
