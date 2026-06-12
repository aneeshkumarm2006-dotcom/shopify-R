"use server";

import { revalidatePath } from "next/cache";
import type { InventoryReason } from "@/types";
import { adjustInventory, recordEvent } from "@/lib/data";
import { requireMerchantStoreId, assertNotImpersonating, getActorUserId } from "@/lib/auth";

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
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const res = await adjustInventory(storeId, input);
  if (!res) return { ok: false };
  await recordEvent({
    type: "inventory.adjusted",
    storeId,
    actorUserId: await getActorUserId(),
    target: { kind: "variant", id: input.variantId },
    metadata: {
      // A signed delta is only known for relative ("add") adjustments; a "set"
      // logs its absolute target as resultingQuantity instead.
      delta: input.mode === "add" ? input.amount : res.resultingQuantity,
      reason: input.reason,
      mode: input.mode,
    },
  });
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true, resultingQuantity: res.resultingQuantity };
}
