import type { Metadata } from "next";
import { getPages, getStore } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { PagesIndex } from "@/components/admin/pages-index";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesPage() {
  const storeId = await requireMerchantStoreId();
  const [pages, store] = await Promise.all([getPages(storeId), getStore(storeId)]);
  return <PagesIndex pages={pages} storeSubdomain={store?.subdomain} />;
}
