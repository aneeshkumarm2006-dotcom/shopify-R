import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomer, getOrdersForCustomer } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { CustomerDetail } from "@/components/admin/customer-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const customer = await getCustomer(await requireMerchantStoreId(), id);
  return { title: customer ? customer.name : "Customer" };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await requireMerchantStoreId();
  const [customer, orders] = await Promise.all([
    getCustomer(storeId, id),
    getOrdersForCustomer(storeId, id),
  ]);
  if (!customer) notFound();
  return <CustomerDetail customer={customer} orders={orders} />;
}
