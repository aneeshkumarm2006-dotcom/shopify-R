"use server";

import { revalidatePath } from "next/cache";
import { setCustomerTags, recordEvent } from "@/lib/data";
import { requireMerchantStoreId, assertNotImpersonating, getActorUserId } from "@/lib/auth";

/**
 * Customer admin actions (Phase 5). Currently: segmentation tags. storeId resolves
 * server-side (tenant isolation); tags are normalized + de-duplicated in the data layer.
 */
export async function updateCustomerTags(
  id: string,
  tags: string[],
): Promise<{ ok: boolean; tags?: string[]; error?: string }> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false, error: "Read-only: exit impersonation to make changes." }; }
  const updated = await setCustomerTags(storeId, id, tags);
  if (!updated) return { ok: false, error: "Couldn't update tags." };
  await recordEvent({
    type: "customer.tagged",
    storeId,
    actorUserId: await getActorUserId(),
    target: { kind: "customer", id, label: updated.name },
    metadata: { tags: updated.tags ?? [] },
  });
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  return { ok: true, tags: updated.tags ?? [] };
}
