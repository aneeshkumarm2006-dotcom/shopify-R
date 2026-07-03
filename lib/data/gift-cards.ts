import { randomInt } from "node:crypto";
import type { GiftCard } from "@/types";
import { isDbConfigured, GiftCards } from "@/lib/db";

/** Round stored value to whole cents (gift cards are money — no fractional-cent drift). */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Gift cards (Phase 4) — store-issued stored value redeemed at checkout. The math
 * (`applyGiftCard`) and the redeemability check (`giftCardState`) are pure so they're
 * unit-tested without a DB; the persistence below decrements the balance atomically
 * with a guarded `$inc` so two concurrent checkouts can't overspend one card.
 */

/* ----------------------------------------------------------- pure logic ---- */

/** Apply a card balance against an amount due. Never goes negative on either side. */
export function applyGiftCard(
  balance: number,
  amountDue: number,
): { applied: number; remainingBalance: number; remainingDue: number } {
  const applied = round2(Math.max(0, Math.min(balance, amountDue)));
  return {
    applied,
    remainingBalance: round2(balance - applied),
    remainingDue: round2(amountDue - applied),
  };
}

export type GiftCardState = "valid" | "disabled" | "expired" | "empty";

/** Classify a card for redemption (pure; caller supplies the clock). */
export function giftCardState(
  card: Pick<GiftCard, "status" | "balance" | "expiresAt">,
  nowMs: number = Date.now(),
): GiftCardState {
  if (card.status !== "active") return "disabled";
  if (card.expiresAt && new Date(card.expiresAt).getTime() < nowMs) return "expired";
  if (card.balance <= 0) return "empty";
  return "valid";
}

const GIFT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I

/**
 * Generate a human-friendly gift-card code, e.g. `GIFT-AB3K-9XQF-M2WP`. Gift cards are
 * bearer money instruments, so the default draws from a CSPRNG (`crypto.randomInt`) —
 * NOT `Math.random`, whose PRNG state is recoverable from a few observed codes, letting
 * an attacker predict and redeem others. The `rand` seam stays injectable for tests.
 */
export function generateGiftCardCode(rand?: () => number): string {
  const pick = rand
    ? () => GIFT_ALPHABET[Math.floor(rand() * GIFT_ALPHABET.length)]
    : () => GIFT_ALPHABET[randomInt(GIFT_ALPHABET.length)];
  const group = () => Array.from({ length: 4 }, pick).join("");
  return `GIFT-${group()}-${group()}-${group()}`;
}

/* --------------------------------------------------------------- data ------ */

export interface GiftCardInput {
  initialBalance: number;
  currency: string;
  note?: string;
  expiresAt?: string | null;
  code?: string; // optional explicit code; generated when omitted
}

export async function listGiftCards(storeId: string): Promise<GiftCard[]> {
  if (!isDbConfigured()) return [];
  return GiftCards.findMany(storeId, {}, { sort: { createdAt: -1 } });
}

export async function getGiftCardByCode(
  storeId: string,
  code: string,
): Promise<GiftCard | null> {
  if (!isDbConfigured()) return null;
  return GiftCards.findOne(storeId, { code: code.trim().toUpperCase() });
}

/** Issue a new gift card. Throws `CODE_TAKEN` on a duplicate code. */
export async function createGiftCard(
  storeId: string,
  input: GiftCardInput,
): Promise<GiftCard> {
  const code = (input.code?.trim() || generateGiftCardCode()).toUpperCase();
  if (!isDbConfigured()) {
    const at = new Date().toISOString();
    return {
      _id: `gc_${Math.random().toString(36).slice(2, 10)}`,
      storeId,
      code,
      initialBalance: input.initialBalance,
      balance: input.initialBalance,
      currency: input.currency,
      status: "active",
      note: input.note ?? "",
      expiresAt: input.expiresAt ?? null,
      createdAt: at,
      updatedAt: at,
    } as GiftCard;
  }
  try {
    return await GiftCards.create(storeId, {
      code,
      initialBalance: input.initialBalance,
      balance: input.initialBalance,
      currency: input.currency,
      note: input.note ?? "",
      expiresAt: input.expiresAt ?? null,
      status: "active",
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
      throw new Error("CODE_TAKEN");
    }
    throw err instanceof Error ? err : new Error("Gift card write failed");
  }
}

/** Enable/disable a card (merchant control). */
export async function setGiftCardStatus(
  storeId: string,
  id: string,
  status: GiftCard["status"],
): Promise<GiftCard | null> {
  if (!isDbConfigured()) return null;
  return GiftCards.updateOne(storeId, { _id: id }, { $set: { status } });
}

/**
 * Validate a code for checkout. Returns the redeemable card or a typed reason — never
 * leaks balance for a disabled/expired card.
 */
export async function validateGiftCard(
  storeId: string,
  code: string,
): Promise<{ ok: true; card: GiftCard } | { ok: false; reason: GiftCardState | "not_found" }> {
  const card = await getGiftCardByCode(storeId, code);
  if (!card) return { ok: false, reason: "not_found" };
  const state = giftCardState(card);
  return state === "valid" ? { ok: true, card } : { ok: false, reason: state };
}

/**
 * Atomically draw `amount` from a card. The guarded filter (`balance ≥ amount`,
 * still active) makes the decrement safe under concurrency — a second checkout that
 * would overspend simply matches nothing and gets `null`.
 */
export async function redeemGiftCard(
  storeId: string,
  code: string,
  amount: number,
): Promise<GiftCard | null> {
  if (!isDbConfigured() || amount <= 0) return null;
  return GiftCards.updateOne(
    storeId,
    { code: code.trim().toUpperCase(), status: "active", balance: { $gte: amount } },
    { $inc: { balance: -amount } },
  );
}

/**
 * Re-credit a card (compensating action if an order fails after redemption). Guarded so
 * the balance can never exceed `initialBalance` — a stale/duplicate compensation can't
 * inflate a card's value beyond what was issued.
 */
export async function creditGiftCard(
  storeId: string,
  code: string,
  amount: number,
): Promise<void> {
  if (!isDbConfigured() || amount <= 0) return;
  await GiftCards.updateOne(
    storeId,
    {
      code: code.trim().toUpperCase(),
      $expr: { $lte: [{ $add: ["$balance", amount] }, "$initialBalance"] },
    },
    { $inc: { balance: amount } },
  );
}
