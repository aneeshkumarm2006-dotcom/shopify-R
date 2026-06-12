import type { Discount, DiscountType, DiscountStatus } from "@/types";
import { resolve } from "./_util";
import { isDbConfigured, Discounts } from "@/lib/db";

/**
 * Discounts / promo codes (storeId-scoped). Codes are validated and applied
 * SERVER-SIDE at checkout — the client never computes its own discount — so a
 * tampered request can't conjure a price cut. `computeDiscountAmount` is the pure
 * money math; `validateDiscount` is the gate (existence, window, min, usage cap).
 */

export interface DiscountInput {
  code: string;
  type: DiscountType;
  value: number;
  minSubtotal?: number;
  usageLimit?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: DiscountStatus;
}

/** Why a code couldn't be applied — surfaced to the shopper in the cart. */
export type DiscountRejection =
  | "not_found"
  | "disabled"
  | "not_started"
  | "expired"
  | "below_min"
  | "used_up";

export type DiscountValidation =
  | { ok: true; code: string; amount: number; discount: Discount }
  | { ok: false; reason: DiscountRejection };

const stamp = () => new Date().toISOString();
const normalize = (code: string) => code.trim().toUpperCase();

/** Round to whole cents — keeps percentage math off floating-point cliffs. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The discount amount for a subtotal — pure, clamped to `[0, subtotal]` so a code
 * can never make a total negative. `percentage` is value%; `fixed` is a flat amount.
 */
export function computeDiscountAmount(subtotal: number, discount: Discount): number {
  const raw =
    discount.type === "percentage" ? (subtotal * discount.value) / 100 : discount.value;
  return Math.max(0, Math.min(round2(raw), subtotal));
}

/* -------------------------------------------------------------- reads ---- */

export async function getDiscounts(storeId: string): Promise<Discount[]> {
  if (!isDbConfigured()) return resolve([]);
  return Discounts.findMany(storeId, {}, { sort: { createdAt: -1 } });
}

export async function getDiscountById(storeId: string, id: string): Promise<Discount | null> {
  if (!isDbConfigured()) return null;
  return Discounts.findById(storeId, id);
}

/**
 * Validate a code against a subtotal and return the computed amount when usable.
 * The single source of truth the cart preview AND checkout both call (never trust a
 * client-supplied amount). Mock mode has no discounts, so every code is `not_found`.
 */
export async function validateDiscount(
  storeId: string,
  rawCode: string,
  subtotal: number,
): Promise<DiscountValidation> {
  const code = normalize(rawCode);
  if (!code || !isDbConfigured()) return { ok: false, reason: "not_found" };

  const discount = await Discounts.findOne(storeId, { code });
  if (!discount) return { ok: false, reason: "not_found" };
  if (discount.status !== "active") return { ok: false, reason: "disabled" };

  const now = Date.now();
  if (discount.startsAt && new Date(discount.startsAt).getTime() > now) {
    return { ok: false, reason: "not_started" };
  }
  if (discount.endsAt && new Date(discount.endsAt).getTime() < now) {
    return { ok: false, reason: "expired" };
  }
  if (discount.usageLimit != null && discount.usedCount >= discount.usageLimit) {
    return { ok: false, reason: "used_up" };
  }
  if (subtotal < discount.minSubtotal) {
    return { ok: false, reason: "below_min" };
  }

  return { ok: true, code, amount: computeDiscountAmount(subtotal, discount), discount };
}

/* ------------------------------------------------------------- writes ---- */

export async function createDiscount(storeId: string, input: DiscountInput): Promise<Discount> {
  if (!isDbConfigured()) {
    const at = stamp();
    return resolve({
      _id: `disc_${Math.random().toString(36).slice(2, 10)}`,
      storeId,
      code: normalize(input.code),
      type: input.type,
      value: input.value,
      minSubtotal: input.minSubtotal ?? 0,
      usageLimit: input.usageLimit ?? null,
      usedCount: 0,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      status: input.status ?? "active",
      createdAt: at,
      updatedAt: at,
    } as Discount);
  }
  try {
    return await Discounts.create(storeId, {
      code: normalize(input.code),
      type: input.type,
      value: input.value,
      minSubtotal: input.minSubtotal ?? 0,
      usageLimit: input.usageLimit ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      status: input.status ?? "active",
    });
  } catch (err) {
    throw mapCodeClash(err);
  }
}

export async function updateDiscount(
  storeId: string,
  id: string,
  input: DiscountInput,
): Promise<Discount | null> {
  if (!isDbConfigured()) return null;
  try {
    return await Discounts.updateOne(
      storeId,
      { _id: id },
      {
        $set: {
          code: normalize(input.code),
          type: input.type,
          value: input.value,
          minSubtotal: input.minSubtotal ?? 0,
          usageLimit: input.usageLimit ?? null,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          ...(input.status ? { status: input.status } : {}),
        },
      },
    );
  } catch (err) {
    throw mapCodeClash(err);
  }
}

export async function deleteDiscount(storeId: string, id: string): Promise<boolean> {
  if (!isDbConfigured()) return true;
  return Discounts.deleteOne(storeId, { _id: id });
}

/** Count one redemption against a code (called once an order using it is placed). */
export async function redeemDiscount(storeId: string, code: string): Promise<void> {
  if (!isDbConfigured()) return;
  await Discounts.updateOne(storeId, { code: normalize(code) }, { $inc: { usedCount: 1 } });
}

function mapCodeClash(err: unknown): Error {
  if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
    return new Error("CODE_TAKEN");
  }
  return err instanceof Error ? err : new Error("Discount write failed");
}
