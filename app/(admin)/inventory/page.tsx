import type { Metadata } from "next";
import { getInventory, getInventoryAdjustments } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { Inventory } from "@/components/admin/inventory";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const storeId = await requireMerchantStoreId();
  const [rows, adjustments] = await Promise.all([
    getInventory(storeId),
    getInventoryAdjustments(storeId),
  ]);
  return <Inventory rows={rows} adjustments={adjustments} />;
}
