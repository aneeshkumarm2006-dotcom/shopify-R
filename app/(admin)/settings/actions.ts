"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import type { SubscriptionPlan } from "@/types";
import { storeTag, recordTag } from "@/lib/cache/tags";
import { updateStore, setSubscriptionPlan, recordEvent, type StoreUpdate } from "@/lib/data";
import { subdomainTag } from "@/lib/cache/tags";
import { requireMerchantStoreId, assertNotImpersonating, getActorUserId } from "@/lib/auth";

/**
 * Settings save action (Stage 9). Persists store details, the Cloudinary brand
 * logo URL (`settings.logoUrl`), SEO defaults, age-gate copy, and code-injection
 * content for the signed-in merchant's store. storeId is resolved server-side.
 */
export async function saveStoreSettings(
  update: StoreUpdate,
): Promise<{ ok: boolean }> {
  const storeId = await requireMerchantStoreId();
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
  // The storefront reads the store record via getStoreBySubdomain (tagged by
  // subdomain) AND getStore (tagged by record) — bust both so settings/name/SEO
  // changes show on the live store, not just the admin.
  revalidateTag(recordTag(storeId));
  if (saved.subdomain) revalidateTag(subdomainTag(saved.subdomain));
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
  // Plan is a coarse store attribute (drives the store cap) — nuke the tenant's
  // record + coarse cache so any plan-derived read refreshes.
  revalidateTag(storeTag(storeId));
  revalidateTag(recordTag(storeId));
  return { ok: true };
}
