"use server";

import { revalidatePath } from "next/cache";
import { updateStore, type StoreUpdate } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";

/**
 * Settings save action (Stage 9). Persists store details, the Cloudinary brand
 * logo URL (`settings.logoUrl`), SEO defaults, age-gate copy, and code-injection
 * content for the signed-in merchant's store. storeId is resolved server-side.
 */
export async function saveStoreSettings(
  update: StoreUpdate,
): Promise<{ ok: boolean }> {
  const storeId = await requireMerchantStoreId();
  const saved = await updateStore(storeId, update);
  if (!saved) return { ok: false };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
