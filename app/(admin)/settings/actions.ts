"use server";

import { revalidatePath } from "next/cache";
import type { SubscriptionPlan } from "@/types";
import { updateStore, setSubscriptionPlan, type StoreUpdate } from "@/lib/data";
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

/**
 * Change the active store's subscription plan (manual billing — no processor in the
 * MVP). `requireMerchantStoreId` resolves the signed-in merchant's active, ownership-
 * verified store, so a caller can only ever change their own plan. Revalidates the
 * admin layout so the store-switcher's premium cap (free 1 → standard 10) updates.
 */
export async function setPlanAction(plan: SubscriptionPlan): Promise<{ ok: boolean }> {
  if (plan !== "free" && plan !== "standard") return { ok: false };
  const storeId = await requireMerchantStoreId();
  const updated = await setSubscriptionPlan(storeId, plan);
  if (!updated) return { ok: false };
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
