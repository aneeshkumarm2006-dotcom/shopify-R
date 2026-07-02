"use server";

import { revalidatePath } from "next/cache";
import { createGiftCard, setGiftCardStatus, getStore, recordEvent } from "@/lib/data";
import type { GiftCardStatus } from "@/types";
import { storeCurrency } from "@/lib/format";
import { requirePermission, assertNotImpersonating, getActorUserId } from "@/lib/auth";

/**
 * Gift-card admin actions (Phase 4). storeId resolves server-side (tenant isolation);
 * the card's currency is taken from the store's own settings, never the client. Codes
 * are generated server-side unless the merchant supplies one.
 */

export interface IssueResult {
  ok: boolean;
  code?: string;
  error?: string;
}

export async function issueGiftCard(input: {
  amount: number;
  note?: string;
  code?: string;
  expiresAt?: string | null;
}): Promise<IssueResult> {
  const storeId = await requirePermission("discounts");
  try { await assertNotImpersonating(); } catch { return { ok: false, error: "Read-only: exit impersonation to make changes." }; }

  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount greater than zero." };

  const store = await getStore(storeId);
  try {
    const card = await createGiftCard(storeId, {
      initialBalance: amount,
      currency: storeCurrency(store?.settings),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      ...(input.code?.trim() ? { code: input.code.trim() } : {}),
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    });
    await recordEvent({
      type: "giftcard.issued",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "giftcard", id: card._id, label: card.code },
      metadata: { amount },
    });
    revalidatePath("/gift-cards");
    return { ok: true, code: card.code };
  } catch (err) {
    if (err instanceof Error && err.message === "CODE_TAKEN") {
      return { ok: false, error: "That code is already in use." };
    }
    return { ok: false, error: "Couldn't issue the gift card. Please try again." };
  }
}

export async function toggleGiftCardStatus(
  id: string,
  status: GiftCardStatus,
): Promise<{ ok: boolean }> {
  const storeId = await requirePermission("discounts");
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const updated = await setGiftCardStatus(storeId, id, status);
  if (updated) {
    await recordEvent({
      type: "giftcard.status_changed",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "giftcard", id, label: updated.code },
      metadata: { status },
    });
  }
  revalidatePath("/gift-cards");
  return { ok: Boolean(updated) };
}
