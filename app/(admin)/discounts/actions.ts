"use server";

import { revalidatePath } from "next/cache";
import {
  createDiscount,
  updateDiscount,
  deleteDiscount,
  recordEvent,
  type DiscountInput,
} from "@/lib/data";
import { requirePermission, assertNotImpersonating, getActorUserId } from "@/lib/auth";

/**
 * Server actions backing the discounts admin (PRD §6.4 — promo codes). Each
 * resolves the signed-in merchant's `storeId` server-side (tenant isolation, §9)
 * and revalidates the index so a write is reflected. A duplicate code surfaces as
 * a friendly message. Results are plain serializable objects the client branches on.
 */

export interface DiscountSaveResult {
  ok: boolean;
  id?: string;
  /** A user-facing reason when `ok` is false (e.g. code already in use). */
  error?: string;
}

function revalidateDiscounts() {
  revalidatePath("/discounts");
}

export async function createDiscountAction(
  input: DiscountInput,
): Promise<DiscountSaveResult> {
  const storeId = await requirePermission("discounts");
  try { await assertNotImpersonating(); } catch { return { ok: false, error: "Read-only: exit impersonation to make changes." }; }
  try {
    const created = await createDiscount(storeId, input);
    await recordEvent({
      type: "discount.created",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "discount", id: created._id, label: input.code },
    });
    revalidateDiscounts();
    return { ok: true, id: created._id };
  } catch (err) {
    if (err instanceof Error && err.message === "CODE_TAKEN") {
      return { ok: false, error: "That code is already in use." };
    }
    return { ok: false, error: "Couldn't save the discount. Please try again." };
  }
}

export async function updateDiscountAction(
  id: string,
  input: DiscountInput,
): Promise<DiscountSaveResult> {
  const storeId = await requirePermission("discounts");
  try { await assertNotImpersonating(); } catch { return { ok: false, error: "Read-only: exit impersonation to make changes." }; }
  try {
    const updated = await updateDiscount(storeId, id, input);
    if (!updated) return { ok: false, error: "Discount not found." };
    await recordEvent({
      type: "discount.updated",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "discount", id, label: input.code },
    });
    revalidateDiscounts();
    return { ok: true, id };
  } catch (err) {
    if (err instanceof Error && err.message === "CODE_TAKEN") {
      return { ok: false, error: "That code is already in use." };
    }
    return { ok: false, error: "Couldn't save the discount. Please try again." };
  }
}

export async function deleteDiscountAction(id: string): Promise<{ ok: boolean }> {
  const storeId = await requirePermission("discounts");
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const ok = await deleteDiscount(storeId, id);
  if (ok) {
    await recordEvent({
      type: "discount.deleted",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "discount", id },
    });
  }
  revalidateDiscounts();
  return { ok };
}
