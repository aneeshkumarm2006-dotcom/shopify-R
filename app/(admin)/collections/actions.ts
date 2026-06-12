"use server";

import { revalidatePath } from "next/cache";
import {
  createCollection,
  updateCollection,
  deleteCollection,
  recordEvent,
  type CollectionInput,
} from "@/lib/data";
import { requireMerchantStoreId, assertNotImpersonating, getActorUserId } from "@/lib/auth";

/**
 * Server actions for the collections admin (Stage 9, PRD §5.5 — manual grouping,
 * no smart rules). Membership is the curated `productIds` array; there are no
 * automated conditions. storeId is resolved server-side (tenant isolation, §9).
 */

export interface CollectionSaveResult {
  ok: boolean;
  id?: string;
  error?: string;
}

function revalidateCollections(handle?: string) {
  revalidatePath("/collections");
  revalidatePath("/products");
  // The storefront collection page reads by handle.
  if (handle) revalidatePath(`/collections/${handle}`);
}

export async function saveCollection(
  id: string | null,
  input: CollectionInput,
): Promise<CollectionSaveResult> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false, error: "Read-only: exit impersonation to make changes." }; }
  if (!input.title.trim()) return { ok: false, error: "Add a collection title." };
  if (!input.handle.trim()) return { ok: false, error: "Add a handle." };
  try {
    if (id) {
      const updated = await updateCollection(storeId, id, input);
      if (!updated) return { ok: false, error: "Collection not found." };
      await recordEvent({
        type: "collection.updated",
        storeId,
        actorUserId: await getActorUserId(),
        target: { kind: "collection", id, label: input.title },
      });
      revalidateCollections(input.handle);
      return { ok: true, id };
    }
    const created = await createCollection(storeId, input);
    await recordEvent({
      type: "collection.created",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "collection", id: created._id, label: input.title },
    });
    revalidateCollections(input.handle);
    return { ok: true, id: created._id };
  } catch (err) {
    if (err instanceof Error && err.message === "HANDLE_TAKEN") {
      return { ok: false, error: "That handle is already used by another collection." };
    }
    return { ok: false, error: "Couldn't save the collection. Please try again." };
  }
}

export async function removeCollection(id: string): Promise<{ ok: boolean }> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const ok = await deleteCollection(storeId, id);
  if (ok) {
    await recordEvent({
      type: "collection.deleted",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "collection", id },
    });
  }
  revalidateCollections();
  return { ok };
}
