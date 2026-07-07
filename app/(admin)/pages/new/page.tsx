import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { PageEditor } from "@/components/admin/page-editor";

export const metadata: Metadata = { title: "New page" };

export default async function NewPagePage() {
  const store = await getStore(await requireMerchantStoreId());
  if (!store) notFound();
  return <PageEditor page={null} storeSubdomain={store.subdomain} />;
}
