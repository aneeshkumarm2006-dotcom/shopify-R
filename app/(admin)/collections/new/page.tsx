import type { Metadata } from "next";
import { getProducts, getStore } from "@/lib/data";
import { notFound } from "next/navigation";
import { requireMerchantStoreId } from "@/lib/auth";
import { CollectionEditor } from "@/components/admin/collection-editor";

export const metadata: Metadata = { title: "New collection" };

export default async function NewCollectionPage() {
  const storeId = await requireMerchantStoreId();
  const [store, products] = await Promise.all([getStore(storeId), getProducts(storeId)]);
  if (!store) notFound();
  return (
    <CollectionEditor
      collection={null}
      products={products}
      storeSubdomain={store.subdomain}
    />
  );
}
