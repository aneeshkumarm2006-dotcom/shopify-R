import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollections, getCollectionIdsForProduct, getProduct, getStore } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { ProductEditor } from "@/components/admin/product-editor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(await requireMerchantStoreId(), id);
  return { title: product ? product.title : "Product" };
}

export default async function ProductEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await requireMerchantStoreId();
  const [store, product, collections, memberOf] = await Promise.all([
    getStore(storeId),
    getProduct(storeId, id),
    getCollections(storeId),
    getCollectionIdsForProduct(storeId, id),
  ]);
  if (!store || !product) notFound();
  return (
    <ProductEditor
      product={product}
      collections={collections}
      memberOf={memberOf}
      storeSubdomain={store.subdomain}
    />
  );
}
