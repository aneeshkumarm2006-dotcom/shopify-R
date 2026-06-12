import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDiscounts, getStore } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { Discounts } from "@/components/admin/discounts";

export const metadata: Metadata = { title: "Discounts" };

export default async function DiscountsPage() {
  const storeId = await requireMerchantStoreId();
  const [discounts, store] = await Promise.all([
    getDiscounts(storeId),
    getStore(storeId),
  ]);
  if (!store) notFound();
  return <Discounts discounts={discounts} currency={store.settings.currency} />;
}
