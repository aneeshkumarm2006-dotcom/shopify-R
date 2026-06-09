import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
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
  const order = await getOrder(await requireMerchantStoreId(), id);
  if (!order) notFound();
  return <OrderDetail order={order} customerId={order.customerId} />;
}
