import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProducts, getStore } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { Publish } from "@/components/admin/publish";

export const metadata: Metadata = { title: "Publish" };

export default async function PublishPage() {
  const storeId = await requireMerchantStoreId();
  const [store, activeProducts] = await Promise.all([
    getStore(storeId),
    getProducts(storeId, { status: "active" }),
  ]);
  if (!store) notFound();
  return <Publish store={store} activeProductCount={activeProducts.length} />;
}
