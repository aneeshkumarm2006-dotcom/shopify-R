import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageById, getStore } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { PageEditor } from "@/components/admin/page-editor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const page = await getPageById(await requireMerchantStoreId(), id);
  return { title: page ? page.title : "Page" };
}

export default async function PageEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storeId = await requireMerchantStoreId();
  const [store, page] = await Promise.all([getStore(storeId), getPageById(storeId, id)]);
  if (!store || !page) notFound();
  return <PageEditor page={page} storeSubdomain={store.subdomain} />;
}
