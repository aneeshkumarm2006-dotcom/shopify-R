import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/data";
import { listDomainsForStore } from "@/lib/data/domains";
import { requireMerchantStoreId } from "@/lib/auth";
import { DomainsClient } from "./_components/domains-client";

export const metadata: Metadata = { title: "Domains" };

export default async function DomainsPage() {
  const storeId = await requireMerchantStoreId();
  const [store, domains] = await Promise.all([
    getStore(storeId),
    listDomainsForStore(storeId),
  ]);
  if (!store) notFound();
  return <DomainsClient initialDomains={domains} subdomain={store.subdomain} />;
}
