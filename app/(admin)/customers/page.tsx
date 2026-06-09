import type { Metadata } from "next";
import { getCustomers } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { CustomersIndex } from "@/components/admin/customers-index";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const customers = await getCustomers(await requireMerchantStoreId());
  return <CustomersIndex customers={customers} />;
}
