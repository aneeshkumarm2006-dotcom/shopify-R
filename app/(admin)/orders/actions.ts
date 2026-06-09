"use server";

import { revalidatePath } from "next/cache";
import type { FulfillmentStatus, PaymentStatus } from "@/types";
import { updateOrderStatus } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";

/**
 * Order management actions (Stage 10, PRD §6.7). Manual payment/fulfillment status
 * edits for the signed-in merchant's store — `storeId` resolved server-side, never
 * trusted from the client. Revalidates the order detail + index + dashboard so the
 * change shows everywhere it surfaces.
 */
export async function setOrderStatus(
  id: string,
  patch: { paymentStatus?: PaymentStatus; fulfillmentStatus?: FulfillmentStatus },
): Promise<{ ok: boolean }> {
  const storeId = await requireMerchantStoreId();
  const updated = await updateOrderStatus(storeId, id, patch);
  if (!updated) return { ok: false };
  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  return { ok: true };
}
