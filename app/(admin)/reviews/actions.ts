"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { setReviewStatus, deleteReview, recordEvent } from "@/lib/data";
import { reviewsTag } from "@/lib/cache/tags";
import type { ReviewStatus } from "@/types";
import { requireMerchantStoreId, assertNotImpersonating, getActorUserId } from "@/lib/auth";

/**
 * Review moderation actions (Phase 4). Reviews auto-publish; merchants hide abusive
 * ones or restore them. storeId resolves server-side (tenant isolation, §9).
 */

export async function moderateReview(
  id: string,
  status: ReviewStatus,
): Promise<{ ok: boolean }> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const updated = await setReviewStatus(storeId, id, status);
  if (updated) {
    await recordEvent({
      type: "review.moderated",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "review", id },
      metadata: { status },
    });
    revalidatePath("/reviews");
    revalidatePath(`/products/${updated.productId}`);
    revalidateTag(reviewsTag(storeId));
  }
  return { ok: Boolean(updated) };
}

export async function removeReview(id: string): Promise<{ ok: boolean }> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const ok = await deleteReview(storeId, id);
  if (ok) {
    await recordEvent({
      type: "review.deleted",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "review", id },
    });
    revalidatePath("/reviews");
    revalidateTag(reviewsTag(storeId));
  }
  return { ok };
}
