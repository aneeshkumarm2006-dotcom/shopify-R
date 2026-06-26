import type { Cart, Store } from "@/types";
import { isDbConfigured, dbConnect, serializeMany, CartModel, Carts } from "@/lib/db";
import { getStore } from "./store";
import { getProductsByIds } from "./products";
import { getCustomer } from "./customers";
import { customerCartKey } from "./cart";
import { storeDomain } from "@/lib/format";
import { sendAbandonedCartEmail } from "@/lib/email";

/**
 * Abandoned-cart recovery sweep (Phase 5). Cross-tenant by design (a single cron pass
 * serves every store), so the FIND uses the raw model like the platform reads; each
 * cart's follow-up work is then routed through the store-scoped seams. A cart is a
 * recovery candidate when it's still `active`, non-empty, untouched for `olderThanHours`,
 * and not yet swept. Sweeping flips it to `abandoned` so it's processed exactly once.
 */

const HOUR_MS = 60 * 60 * 1000;

/** Find stale active carts across all stores (cron read; capped). */
export async function findAbandonedCarts(cutoffIso: string, limit = 100): Promise<Cart[]> {
  if (!isDbConfigured()) return [];
  await dbConnect();
  const rows = await CartModel.find({
    status: "active",
    recoveryEmailedAt: null,
    updatedAt: { $lt: new Date(cutoffIso) },
    "items.0": { $exists: true }, // non-empty
  })
    .limit(limit)
    .lean();
  return serializeMany<Cart>(rows);
}

/** Mark a cart abandoned (and, when emailed, stamp the recovery time). */
async function sweepCart(storeId: string, cartId: string, emailed: boolean): Promise<void> {
  await Carts.updateOne(
    storeId,
    { _id: cartId },
    {
      $set: {
        status: "abandoned",
        ...(emailed ? { recoveryEmailedAt: new Date().toISOString() } : {}),
      },
    },
  );
}

/** Resolve the recipient for a cart: the captured email, else a logged-in shopper's. */
async function recipientFor(cart: Cart): Promise<string | null> {
  if (cart.email?.trim()) return cart.email.trim();
  if (cart.sessionId.startsWith(customerCartKey(""))) {
    const customerId = cart.sessionId.slice(customerCartKey("").length);
    const customer = await getCustomer(cart.storeId, customerId);
    return customer?.email ?? null;
  }
  return null;
}

export interface RecoverySweepResult {
  scanned: number;
  emailed: number;
}

/**
 * Run one recovery pass. For each stale cart on a LIVE store, resolve the recipient +
 * line items and send the recovery email, then mark the cart abandoned. Carts with no
 * resolvable recipient (anonymous, no captured email) are still marked abandoned so the
 * queue drains. Best-effort throughout — one failure never aborts the batch.
 */
export async function runAbandonedCartRecovery(
  olderThanHours = 24,
  limit = 100,
): Promise<RecoverySweepResult> {
  const cutoff = new Date(Date.now() - olderThanHours * HOUR_MS).toISOString();
  const carts = await findAbandonedCarts(cutoff, limit);
  const storeCache = new Map<string, Store | null>();
  let emailed = 0;

  for (const cart of carts) {
    try {
      if (!storeCache.has(cart.storeId)) storeCache.set(cart.storeId, await getStore(cart.storeId));
      const store = storeCache.get(cart.storeId) ?? null;
      if (!store || store.status !== "live") {
        // Leave non-live stores' carts active; they can recover once published.
        continue;
      }

      const to = await recipientFor(cart);
      if (!to) {
        await sweepCart(cart.storeId, cart._id, false);
        continue;
      }

      const products = await getProductsByIds(
        cart.storeId,
        [...new Set(cart.items.map((i) => i.productId))],
      );
      const byId = new Map(products.map((p) => [p._id, p]));
      const lines = cart.items
        .map((item) => {
          const product = byId.get(item.productId);
          if (!product) return null;
          const variant = product.variants.find((v) => v.id === item.variantId);
          const title =
            variant && product.variants.length > 1 ? `${product.title} · ${variant.title}` : product.title;
          return { title, quantity: item.quantity, price: item.priceSnapshot };
        })
        .filter((l): l is { title: string; quantity: number; price: number } => Boolean(l));

      if (lines.length === 0) {
        await sweepCart(cart.storeId, cart._id, false);
        continue;
      }

      const recoverUrl = `https://${storeDomain(store.subdomain)}/cart`;
      const result = await sendAbandonedCartEmail(store, to, { cart, lines, recoverUrl });
      await sweepCart(cart.storeId, cart._id, result.sent);
      if (result.sent) emailed++;
    } catch {
      /* best-effort: skip this cart, keep sweeping */
    }
  }

  return { scanned: carts.length, emailed };
}
