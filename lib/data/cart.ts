import type { Cart, CartItem } from "@/types";
import { MOCK_STORE_ID } from "./mocks";
import { resolve } from "./_util";
import { isDbConfigured, Carts } from "@/lib/db";

/**
 * Cart seam (PRD §5.7). Carts are session-scoped and anonymous. Stage 6 wires the
 * READ to the `carts` collection (scoped by storeId, matched on sessionId); when
 * no cart exists yet it returns a transient empty active cart. Mutating writes
 * (add/update/persist) arrive in Stage 10 behind this same signature.
 */
export async function getCart(storeId: string, sessionId: string): Promise<Cart> {
  const now = new Date().toISOString();
  const empty: Cart = {
    _id: `cart_${sessionId}`,
    storeId: storeId || MOCK_STORE_ID,
    sessionId,
    items: [],
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  if (!isDbConfigured()) return resolve(empty);

  const existing = await Carts.findOne(storeId, { sessionId, status: "active" });
  return existing ?? empty;
}

/**
 * Persist the session cart (PRD §5.7). Upserts the single active cart for this
 * `(storeId, sessionId)` with the current line items + their price snapshots, so
 * the cart survives across requests/devices. Stored prices are snapshots taken
 * client-side; checkout re-derives authoritative prices from the catalog, so a
 * stale snapshot here never affects an order total. In mock mode (no DB) the cart
 * lives only in the browser, so this is a no-op that echoes a transient cart.
 */
export async function saveCart(
  storeId: string,
  sessionId: string,
  items: CartItem[],
): Promise<Cart> {
  if (!isDbConfigured()) {
    const now = new Date().toISOString();
    return resolve({
      _id: `cart_${sessionId}`,
      storeId: storeId || MOCK_STORE_ID,
      sessionId,
      items,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  }
  return Carts.upsertOne(
    storeId,
    { sessionId, status: "active" },
    { $set: { items } },
  );
}

/* ============================================================
   Customer cart persistence (Phase 3) — a logged-in shopper's cart is keyed by a
   stable derived id so it follows them across devices, distinct from the anonymous
   per-browser session cart.
   ============================================================ */

/** Stable cart key for a logged-in customer (mirrors the anonymous `sessionId` slot). */
export function customerCartKey(customerId: string): string {
  return `cust:${customerId}`;
}

/**
 * Union two carts by `(productId, variantId)`, summing quantities (Phase 3 cart merge
 * on login). Pure + deterministic so it's unit-testable; the price snapshot from the
 * first occurrence wins (checkout re-derives authoritative prices anyway). Items from
 * `a` keep their order; new items from `b` append.
 */
export function mergeCartItems(a: CartItem[], b: CartItem[]): CartItem[] {
  const byKey = new Map<string, CartItem>();
  for (const item of [...a, ...b]) {
    const key = `${item.productId}:${item.variantId}`;
    const existing = byKey.get(key);
    if (existing) existing.quantity += item.quantity;
    else byKey.set(key, { ...item });
  }
  return [...byKey.values()];
}

/**
 * Mark the session's active cart as converted once its order is placed, so a new
 * empty cart starts fresh on the next visit (PRD §5.7 cart lifecycle). No-op when
 * there is no active cart (or no DB).
 */
export async function markCartConverted(
  storeId: string,
  sessionId: string,
): Promise<void> {
  if (!isDbConfigured()) return;
  await Carts.updateOne(
    storeId,
    { sessionId, status: "active" },
    { $set: { status: "converted" } },
  );
}
