"use server";

import { revalidatePath } from "next/cache";
import type { SubscriptionPlan } from "@/types";
import { updateStore, setSubscriptionPlan, recordEvent, getStore, deleteStore, type StoreUpdate } from "@/lib/data";
import { requirePermission, assertNotImpersonating, getActorUserId } from "@/lib/auth";

/**
 * Settings save action (Stage 9). Persists store details, the Cloudinary brand
 * logo URL (`settings.logoUrl`), SEO defaults, age-gate copy, and code-injection
 * content for the signed-in merchant's store. storeId is resolved server-side.
 */
export async function saveStoreSettings(
  update: StoreUpdate,
): Promise<{ ok: boolean }> {
  const storeId = await requirePermission("settings");
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const saved = await updateStore(storeId, update);
  if (!saved) return { ok: false };
  const actorUserId = await getActorUserId();
  await recordEvent({
    type: "settings.updated",
    storeId,
    actorUserId,
    target: { kind: "store", id: storeId },
  });
  if (update.codeInjection) {
    const ci = update.codeInjection;
    const combined = `${ci.headHtml ?? ""}${ci.bodyHtml ?? ""}${ci.customJs ?? ""}`;
    await recordEvent({
      type: "settings.code_injection_changed",
      storeId,
      actorUserId,
      target: { kind: "store", id: storeId },
      metadata: { containsScript: /<script/i.test(combined) },
    });
  }
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
  const storeId = await requirePermission("settings");
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const updated = await setSubscriptionPlan(storeId, plan);
  if (!updated) return { ok: false };
  await recordEvent({
    type: "plan.changed",
    storeId,
    actorUserId: await getActorUserId(),
    target: { kind: "store", id: storeId },
    metadata: { plan },
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Permanently delete the signed-in merchant's store and all of its data. Guarded
 * three ways: `requirePermission("settings")` resolves (and scopes to) the caller's
 * own store; `assertNotImpersonating()` blocks platform operators from deleting a
 * merchant's store while impersonating; and it is OWNER-ONLY — staff/admin members
 * with settings access cannot delete the store. Finally, `confirmName` must exactly
 * match the store name (the UI's type-to-confirm), so it can't fire by accident.
 */
export async function deleteStoreAction(
  confirmName: string,
): Promise<{ ok: boolean; error?: string }> {
  const storeId = await requirePermission("settings");
  try {
    await assertNotImpersonating();
  } catch {
    return { ok: false, error: "Not available while impersonating a store." };
  }
  const store = await getStore(storeId);
  if (!store) return { ok: false, error: "Store not found." };
  const actorUserId = await getActorUserId();
  if (!actorUserId || store.ownerId !== actorUserId) {
    return { ok: false, error: "Only the store owner can delete this store." };
  }
  if (confirmName.trim() !== store.name) {
    return { ok: false, error: "The name you typed doesn't match the store name." };
  }
  // Record the intent on the append-only audit log BEFORE the store row is gone.
  await recordEvent({
    type: "store.deleted",
    storeId,
    actorUserId,
    target: { kind: "store", id: storeId, label: store.name },
  });
  await deleteStore(storeId);
  revalidatePath("/", "layout");
  return { ok: true };
}
