import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollectionById, getProducts, getStore } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { CollectionEditor } from "@/components/admin/collection-editor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const collection = await getCollectionById(await requireMerchantStoreId(), id);
  return { title: collection ? collection.title : "Collection" };
}

export default async function CollectionEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await requireMerchantStoreId();
  const [store, collection, products] = await Promise.all([
    getStore(storeId),
    getCollectionById(storeId, id),
    getProducts(storeId),
  ]);
  if (!store || !collection) notFound();
  return (
    <CollectionEditor
      collection={collection}
      products={products}
      storeSubdomain={store.subdomain}
    />
  );
}
