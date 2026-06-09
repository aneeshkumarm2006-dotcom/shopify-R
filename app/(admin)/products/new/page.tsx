import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollections, getStore } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { ProductEditor } from "@/components/admin/product-editor";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const storeId = await requireMerchantStoreId();
  const [store, collections] = await Promise.all([getStore(storeId), getCollections(storeId)]);
  if (!store) notFound();
  return (
    <ProductEditor
      product={null}
      collections={collections}
      memberOf={[]}
      storeSubdomain={store.subdomain}
    />
  );
}
