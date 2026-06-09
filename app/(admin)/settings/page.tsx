import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore, getSubscription } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { Settings } from "@/components/admin/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const storeId = await requireMerchantStoreId();
  const [store, subscription] = await Promise.all([getStore(storeId), getSubscription(storeId)]);
  if (!store || !subscription) notFound();
  return <Settings store={store} subscription={subscription} />;
}
