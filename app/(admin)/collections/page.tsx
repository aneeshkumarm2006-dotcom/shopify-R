import type { Metadata } from "next";
import { getCollections } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { CollectionsIndex } from "@/components/admin/collections-index";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const collections = await getCollections(await requireMerchantStoreId());
  return <CollectionsIndex collections={collections} />;
}
