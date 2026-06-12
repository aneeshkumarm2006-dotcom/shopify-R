"use server";

import { revalidatePath } from "next/cache";
import type { ProductStatus } from "@/types";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  setProductsStatus,
  deleteProducts,
  duplicateProduct,
  setProductCollections,
  recordEvent,
  type ProductInput,
} from "@/lib/data";
import { requireMerchantStoreId, assertNotImpersonating, getActorUserId } from "@/lib/auth";

/**
 * Server actions backing the products admin (Stage 9, PRD §6.4). Each resolves
 * the signed-in merchant's `storeId` server-side (never trusting the client) and
 * revalidates the affected routes so the index/editor reflect the write. Results
 * are plain serializable objects the client can branch on.
 */

export interface SaveResult {
  ok: boolean;
  id?: string;
  /** A user-facing reason when `ok` is false (e.g. handle already in use). */
  error?: string;
}

function revalidateProducts(id?: string) {
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/collections");
  if (id) revalidatePath(`/products/edit/${id}`);
}

/**
 * Create (id === null) or update an existing product, and reconcile its
 * collection membership in the same call so the editor's Collections picker
 * persists alongside the product.
 */
export async function saveProduct(
  id: string | null,
  input: ProductInput,
  collectionIds: string[] = [],
): Promise<SaveResult> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false, error: "Read-only: exit impersonation to make changes." }; }
  try {
    let productId = id;
    if (id) {
      const updated = await updateProduct(storeId, id, input);
      if (!updated) return { ok: false, error: "Product not found." };
      await recordEvent({
        type: "product.updated",
        storeId,
        actorUserId: await getActorUserId(),
        target: { kind: "product", id, label: input.title },
      });
    } else {
      const created = await createProduct(storeId, input);
      productId = created._id;
      await recordEvent({
        type: "product.created",
        storeId,
        actorUserId: await getActorUserId(),
        target: { kind: "product", id: created._id, label: input.title },
      });
    }
    if (productId) await setProductCollections(storeId, productId, collectionIds);
    revalidateProducts(productId ?? undefined);
    return { ok: true, id: productId ?? undefined };
  } catch (err) {
    if (err instanceof Error && err.message === "HANDLE_TAKEN") {
      return { ok: false, error: "That handle is already used by another product." };
    }
    return { ok: false, error: "Couldn't save the product. Please try again." };
  }
}

export async function removeProduct(id: string): Promise<{ ok: boolean }> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const ok = await deleteProduct(storeId, id);
  if (ok) {
    await recordEvent({
      type: "product.deleted",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "product", id },
    });
  }
  revalidateProducts();
  return { ok };
}

export async function duplicateProductAction(id: string): Promise<SaveResult> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false, error: "Read-only: exit impersonation to make changes." }; }
  const copy = await duplicateProduct(storeId, id);
  if (!copy) return { ok: false, error: "Product not found." };
  await recordEvent({
    type: "product.created",
    storeId,
    actorUserId: await getActorUserId(),
    target: { kind: "product", id: copy._id, label: copy.title },
  });
  revalidateProducts(copy._id);
  return { ok: true, id: copy._id };
}

export async function bulkSetStatusAction(
  ids: string[],
  status: ProductStatus,
): Promise<{ ok: boolean; count: number }> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false, count: 0 }; }
  const count = await setProductsStatus(storeId, ids, status);
  await recordEvent({
    type: "product.status_changed",
    storeId,
    actorUserId: await getActorUserId(),
    metadata: { status, count },
  });
  revalidateProducts();
  return { ok: true, count };
}

export async function bulkDeleteAction(ids: string[]): Promise<{ ok: boolean; count: number }> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false, count: 0 }; }
  const count = await deleteProducts(storeId, ids);
  await recordEvent({
    type: "product.deleted",
    storeId,
    actorUserId: await getActorUserId(),
    metadata: { count },
  });
  revalidateProducts();
  return { ok: true, count };
}
