"use server";

import { revalidatePath } from "next/cache";
import type { FulfillmentStatus, PaymentStatus } from "@/types";
import { updateOrderStatus, createFulfillment, addOrderNote, FulfillmentError, recordEvent } from "@/lib/data";
import { requireMerchantStoreId, assertNotImpersonating, getActorUserId } from "@/lib/auth";

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
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const actorId = await getActorUserId();
  const updated = await updateOrderStatus(storeId, id, patch, actorId);
  if (!updated) return { ok: false };
  await recordEvent({
    type: "order.status_changed",
    storeId,
    actorUserId: await getActorUserId(),
    target: { kind: "order", id },
    metadata: { ...patch },
  });
  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  return { ok: true };
}

export interface FulfillResult {
  ok: boolean;
  error?: string;
}

/**
 * Record a shipment (full or partial) against an order with optional tracking
 * (Phase 3). `storeId` resolved server-side; quantities are clamped to what remains
 * in the data layer. A `FulfillmentError` (cancelled / nothing left) surfaces as a
 * friendly message.
 */
export async function fulfillOrder(
  id: string,
  input: {
    lines: { lineIndex: number; quantity: number }[];
    trackingNumber?: string;
    carrier?: string;
    trackingUrl?: string;
  },
): Promise<FulfillResult> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false, error: "Read-only: exit impersonation to make changes." }; }
  try {
    const updated = await createFulfillment(storeId, id, { ...input, actorId: await getActorUserId() });
    if (!updated) return { ok: false, error: "Order not found." };
    await recordEvent({
      type: "order.fulfilled",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "order", id },
    });
    revalidatePath(`/orders/${id}`);
    revalidatePath("/orders");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    if (err instanceof FulfillmentError) return { ok: false, error: err.message };
    return { ok: false, error: "We couldn't fulfill this order. Please try again." };
  }
}

/** Append a free-text note to an order's timeline (Phase 6). */
export async function addOrderNoteAction(
  id: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false, error: "Read-only: exit impersonation to make changes." }; }
  if (!body.trim()) return { ok: false, error: "Write a note first." };
  const updated = await addOrderNote(storeId, id, body, await getActorUserId());
  if (!updated) return { ok: false, error: "Order not found." };
  await recordEvent({
    type: "order.note_added",
    storeId,
    actorUserId: await getActorUserId(),
    target: { kind: "order", id },
  });
  revalidatePath(`/orders/${id}`);
  return { ok: true };
}
