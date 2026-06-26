import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrder, getStore } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { storeCurrency } from "@/lib/format";
import { OrderDetail } from "@/components/admin/order-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const order = await getOrder(await requireMerchantStoreId(), id);
  return { title: order ? `Order #${order.orderNumber}` : "Order" };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await requireMerchantStoreId();
  const [order, store] = await Promise.all([getOrder(storeId, id), getStore(storeId)]);
  if (!order) notFound();
  return (
    <OrderDetail
      order={order}
      customerId={order.customerId}
      currency={storeCurrency(store?.settings)}
    />
  );
}
