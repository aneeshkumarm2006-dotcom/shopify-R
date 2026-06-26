import type { Metadata } from "next";
import { listCampaigns, getCustomerTags, getCustomers } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { isSmsConfigured } from "@/lib/sms";
import { MarketingAdmin } from "@/components/admin/marketing";

export const metadata: Metadata = { title: "Marketing" };

export default async function MarketingPage() {
  const storeId = await requireMerchantStoreId();
  const [campaigns, tags, customers] = await Promise.all([
    listCampaigns(storeId),
    getCustomerTags(storeId),
    getCustomers(storeId),
  ]);
  return (
    <MarketingAdmin
      campaigns={campaigns}
      tags={tags}
      customerCount={customers.length}
      smsEnabled={isSmsConfigured()}
    />
  );
}
