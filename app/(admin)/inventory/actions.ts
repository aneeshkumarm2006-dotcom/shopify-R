"use server";

import { revalidatePath } from "next/cache";
import type { InventoryReason } from "@/types";
import { adjustInventory } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";

/**
 * Inventory adjustment action (Stage 9, PRD §6.5). Applies a manual stock change
 * for the signed-in merchant and writes the `inventoryAdjustments` audit row. The
 * dashboard low-stock alerts and product/inventory tables are revalidated so the
 * change is reflected everywhere it surfaces.
 */
export async function adjustStock(input: {
  productId: string;
  variantId: string;
  mode: "add" | "set";
  amount: number;
  reason: InventoryReason;
}): Promise<{ ok: boolean; resultingQuantity?: number }> {
  const storeId = await requireMerchantStoreId();
  const res = await adjustInventory(storeId, input);
  if (!res) return { ok: false };
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true, resultingQuantity: res.resultingQuantity };
}
