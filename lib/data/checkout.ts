import type { Address, OrderLineItem, SettlementMethod, Store } from "@/types";
import { getProductsByIds } from "./products";
import { findOrCreateCustomer, recordCustomerOrder } from "./customers";
import { createOrder } from "./orders";
import {
  reserveInventory,
  releaseInventory,
  logOrderDecrements,
  type DecrementLine,
  type AppliedDecrement,
} from "./inventory";
import { markCartConverted } from "./cart";
import { getNextOrderNumber } from "./sequence";
import { getStore } from "./store";
import { validateDiscount, claimDiscount, releaseDiscount } from "./discounts";
import { resolveShippingRate } from "./shipping";
import { computeTax } from "./tax";
import { validateGiftCard, redeemGiftCard, creditGiftCard, applyGiftCard } from "./gift-cards";
import { createPaymentIntent } from "@/lib/payments";
import { sendOrderConfirmation } from "@/lib/email";

/** Round a money amount to whole cents, killing binary-float drift (e.g. 100.30000000001). */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Settlement methods the store offers, keyed by `SettlementMethod`, with safe defaults. */
export function enabledSettlements(store: Store): Record<SettlementMethod, boolean> {
  const s = store.settings.settlement;
  return {
    online: s?.online ?? true,
    cod: s?.cod ?? false,
    in_store: s?.inStore ?? false,
  };
}

/**
 * Checkout orchestration (Stage 10, PRD §6.6). One server-side entry point that
 * turns a cart into a real, pending order:
 *
 *  1. Re-derive authoritative line items from the catalog — the client only sends
 *     `(productId, variantId, quantity)`; prices/titles/SKUs are read from the
 *     store's own products, so a tampered client can't change what it's charged.
 *  2. Match-or-create the `customer` by email within the store.
 *  3. Allocate the next gap-free per-store order number (atomic counter).
 *  4. Persist the `order` as `paymentStatus: pending` with frozen line-item
 *     SNAPSHOTS and the age-gate timestamp (no payment is processed in MVP).
 *  5. Decrement inventory (writes `inventoryAdjustments` with `reason: order`).
 *  6. Update the customer's denormalized `orderCount` / `totalSpent`.
 *  7. Mark the session cart converted.
 *  8. Send the order-confirmation email (Stage 13) — best-effort, never blocks.
 *
 * Everything is routed through the tenant-scoped data seams, so the whole flow is
 * confined to one store (PRD §9).
 */

/** One requested line — the only order data the client is trusted to supply. */
export interface CheckoutLine {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface CheckoutInput {
  contact: Address;
  shippingAddress: Address;
  /** ISO timestamp the customer passed the age gate (read from the gate cookie). */
  ageVerifiedAt: string;
  lines: CheckoutLine[];
  /** Optional promo code — validated + applied SERVER-SIDE (never trust a client amount). */
  discountCode?: string;
  /** How the order settles; validated against the store's enabled methods. */
  settlementMethod?: SettlementMethod;
  /** Anonymous session id, so the persisted cart can be marked converted. */
  sessionId?: string;
  /** Store display currency, carried into the payment seam (defaults to `$`). */
  currency?: string;
  /** Shipping region/state (e.g. "OR") — drives region tax + shipping rate matching. */
  region?: string;
  /** Chosen shipping rate id; the price is re-resolved server-side (never trusted). */
  shippingRateId?: string;
  /** Gift-card code to redeem — validated + drawn down SERVER-SIDE (Phase 4). */
  giftCardCode?: string;
}

export interface PlacedOrder {
  orderId: string;
  orderNumber: number;
  /** Goods total before discount/shipping/tax. */
  subtotal: number;
  discountAmount: number;
  shippingTotal: number;
  shippingMethod: string;
  taxTotal: number;
  /** Amount drawn from a redeemed gift card (0 when none). */
  giftCardAmount: number;
  /** Authoritative amount charged: `(subtotal − discount) + shipping + tax − giftCard`. */
  total: number;
  lineItems: OrderLineItem[];
}

/** Raised when a checkout can't be fulfilled (empty cart, no valid lines, oversell). */
export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

export async function placeOrder(
  storeId: string,
  input: CheckoutInput,
): Promise<PlacedOrder> {
  if (input.lines.length === 0) throw new CheckoutError("Your cart is empty.");

  // 1. Authoritative snapshots from the catalog (never trust client prices).
  const ids = [...new Set(input.lines.map((l) => l.productId))];
  const products = await getProductsByIds(storeId, ids);
  const byId = new Map(products.map((p) => [p._id, p]));

  const lineItems: OrderLineItem[] = [];
  const decrements: DecrementLine[] = [];
  // Aggregate requested quantity per variant so the stock check below accounts for
  // the same variant appearing across multiple cart lines.
  const requested = new Map<
    string,
    { label: string; available: number; tracked: boolean; allowOversell: boolean; qty: number }
  >();
  for (const line of input.lines) {
    const product = byId.get(line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant) continue; // dropped: not this store's, or stale
    // Drop non-finite quantities (a client sending `null`/"abc"/Infinity would make
    // Math.floor → NaN, and a NaN line total silently passes the stock check as
    // `NaN > available === false`). Finite values are clamped to a sane [1, 100000]
    // range (0/negative → 1, matching the friendly UX the tests pin).
    const raw = Number(line.quantity);
    if (!Number.isFinite(raw)) continue;
    const quantity = Math.min(100_000, Math.max(1, Math.floor(raw)));
    lineItems.push({
      title: product.title,
      variant: product.variants.length > 1 ? variant.title : "",
      sku: variant.sku ?? "",
      price: variant.price,
      quantity,
    });
    if (variant.inventory.trackInventory) {
      decrements.push({
        productId: product._id,
        variantId: variant.id,
        quantity,
        policy: variant.inventory.policy,
      });
    }
    const key = `${product._id}::${variant.id}`;
    const entry = requested.get(key) ?? {
      label: variant.title ? `${product.title} · ${variant.title}` : product.title,
      available: variant.inventory.quantity,
      tracked: variant.inventory.trackInventory,
      allowOversell: variant.inventory.policy === "continue",
      qty: 0,
    };
    entry.qty += quantity;
    requested.set(key, entry);
  }

  if (lineItems.length === 0) {
    throw new CheckoutError("None of the items in your cart are available.");
  }

  // Real-time stock check (Phase 2): a tracked variant on a `deny` policy can't be
  // oversold. `continue`-policy and untracked variants are allowed through (the audit
  // log faithfully records any resulting negative quantity).
  for (const item of requested.values()) {
    if (item.tracked && !item.allowOversell && item.qty > item.available) {
      const left = Math.max(0, item.available);
      throw new CheckoutError(
        left === 0
          ? `${item.label} is out of stock.`
          : `Only ${left} of ${item.label} ${left === 1 ? "is" : "are"} left.`,
      );
    }
  }

  const subtotal = round2(lineItems.reduce((sum, l) => sum + l.price * l.quantity, 0));

  // 1b. Load the store once — needed for settlement validation, currency, and the
  //     confirmation email below. (No `getStore` round-trip is repeated at the end.)
  const store = await getStore(storeId);

  // 1c. Apply a promo code if supplied — validated + priced SERVER-SIDE so a tampered
  //     client can't invent a discount. An invalid/expired code is silently ignored
  //     (subtotal stands) rather than failing the whole checkout.
  let discountAmount = 0;
  let discountCode: string | null = null;
  if (input.discountCode) {
    const result = await validateDiscount(storeId, input.discountCode, subtotal);
    // Claim the usage seat ATOMICALLY here (enforces usageLimit under concurrency). Only
    // if the seat is claimed do we apply the discount; a raced-to-cap code is ignored
    // (subtotal stands) rather than over-redeemed. Released on order-persist failure.
    if (result.ok && (await claimDiscount(storeId, result.code))) {
      discountAmount = result.amount;
      discountCode = result.code;
    }
  }
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  // 1c-bis. Shipping + tax (Phase 2). Both resolve SERVER-SIDE from the store's own
  // settings — the client only names a region + rate id, never a price/amount, so a
  // tampered client can't undercut shipping or tax. A store with neither configured
  // gets free "Standard" shipping and zero tax, so `total` stays subtotal − discount.
  const shipping = resolveShippingRate(store?.settings.shipping, {
    subtotal: discountedSubtotal,
    region: input.region,
    rateId: input.shippingRateId,
  });
  const shippingTotal = round2(shipping.price);
  const taxTotal = round2(
    computeTax(store?.settings.tax, {
      subtotal: discountedSubtotal,
      shipping: shippingTotal,
      region: input.region,
    }),
  );
  const grossTotal = round2(discountedSubtotal + shippingTotal + taxTotal);

  // 1d. Validate the settlement method NOW — before any committing side effect — so an
  //     unavailable method fails the checkout without leaving reserved stock / a drawn
  //     gift card / a claimed discount behind to compensate.
  const settlementMethod: SettlementMethod = input.settlementMethod ?? "online";
  if (store && !enabledSettlements(store)[settlementMethod]) {
    // Nothing committed yet except the discount claim above; give it back.
    if (discountCode) await releaseDiscount(storeId, discountCode).catch(() => {});
    throw new CheckoutError("That payment method isn't available for this store.");
  }

  // 1c-quater. RESERVE inventory atomically, BEFORE any committing side effect (gift
  // card draw / order write). The guarded `$inc` in `reserveInventory` is what actually
  // prevents overselling a `deny` variant under concurrent checkouts — the in-memory
  // pre-check above is only a fast early-out. On a race-lost shortfall we release what
  // was applied and reject; nothing else has been committed yet.
  const reservation = await reserveInventory(storeId, decrements);
  if (!reservation.ok) {
    await releaseInventory(storeId, reservation.applied);
    // Give back the discount seat claimed above — this checkout won't complete.
    if (discountCode) await releaseDiscount(storeId, discountCode).catch(() => {});
    const p = byId.get(reservation.failed.productId);
    const v = p?.variants.find((x) => x.id === reservation.failed.variantId);
    const label = v?.title ? `${p?.title} · ${v.title}` : (p?.title ?? "An item");
    throw new CheckoutError(`${label} just went out of stock. Please adjust your cart.`);
  }
  const reservedLines: AppliedDecrement[] = reservation.applied;

  // 1c-ter. Gift card (Phase 4). Validated + drawn down SERVER-SIDE: the client only
  // names a code, never an amount. The atomic guarded `$inc` in `redeemGiftCard` makes
  // the draw safe under concurrent checkouts; if it doesn't match (card emptied/disabled
  // between validate and redeem), we simply don't apply it. A failure to PERSIST the
  // order afterwards re-credits the card (compensating action) so value is never lost.
  let giftCardAmount = 0;
  let giftCardCode: string | null = null;
  if (input.giftCardCode) {
    const gc = await validateGiftCard(storeId, input.giftCardCode);
    // Only draw a card issued in the store's own currency — no implicit FX. `currency`
    // is the store's display symbol; both card and store carry the same symbol string.
    const storeCurrency = store?.settings.currency;
    if (gc.ok && (!storeCurrency || gc.card.currency === storeCurrency)) {
      const applied = round2(applyGiftCard(gc.card.balance, grossTotal).applied);
      if (applied > 0 && (await redeemGiftCard(storeId, gc.card.code, applied))) {
        giftCardAmount = applied;
        giftCardCode = gc.card.code;
      }
    }
  }
  const total = round2(Math.max(0, grossTotal - giftCardAmount));

  // 2–4. From here every step is a committing side effect that can throw
  //   (customer upsert, order-number allocation, payment intent, order persist). Wrap
  //   them ALL in one try so ANY failure compensates every committed resource —
  //   inventory reservation, gift-card draw, and discount claim — leaving no orphaned
  //   debit. (Previously only the createOrder call was guarded, so a throw in the
  //   customer/order-number/intent steps drained a gift card with nothing to show.)
  let order;
  let customerId = "";
  let orderNumber = 0;
  try {
    // 2. Match-or-create the customer by email within the store.
    const customer = await findOrCreateCustomer(storeId, {
      email: input.contact.email,
      name: input.contact.name,
      ...(input.contact.phone ? { phone: input.contact.phone } : {}),
      address: input.shippingAddress,
    });
    customerId = customer._id;

    // 3. Atomic per-store order number.
    orderNumber = await getNextOrderNumber(storeId);

    // 3b. Payment seam (Stage 12, PRD §6.11). A fully gift-card/discount-covered order
    //     has nothing to charge — skip the processor (most PSPs reject a zero amount,
    //     which would fail an already-paid checkout) and settle `paid`. Prefer the
    //     store's ISO-4217 code over the "$" symbol; processors require "USD".
    const currencyCode = store?.settings.currencyCode ?? "USD";
    const isZeroCharge = total <= 0;
    const intent =
      settlementMethod === "online" && !isZeroCharge
        ? await createPaymentIntent(storeId, {
            amount: total,
            currency: currencyCode,
            customerEmail: input.contact.email,
          })
        : null;
    const paymentStatus =
      settlementMethod === "online" && isZeroCharge ? "paid" : (intent?.status ?? "pending");

    order = await createOrder(storeId, {
      storeId,
      orderNumber,
      customerId,
      lineItems,
      subtotal,
      discountAmount,
      discountCode,
      shippingTotal,
      shippingMethod: shipping.label,
      taxTotal,
      giftCardCode,
      giftCardAmount,
      total,
      shippingAddress: input.shippingAddress,
      contact: input.contact,
      settlementMethod,
      paymentStatus,
      fulfillmentStatus: "unfulfilled",
      ageVerifiedAt: input.ageVerifiedAt,
      paymentIntent: intent?.id ?? null,
    });
  } catch (err) {
    // Order failed to persist — undo BOTH committed resources so nothing is lost:
    // re-credit any gift card drawn AND release the inventory reserved above.
    if (giftCardCode && giftCardAmount > 0) {
      await creditGiftCard(storeId, giftCardCode, giftCardAmount).catch(() => {});
    }
    await releaseInventory(storeId, reservedLines).catch(() => {});
    if (discountCode) await releaseDiscount(storeId, discountCode).catch(() => {});
    throw err;
  }

  // 5–7. Log the (already-applied) inventory audit rows, update customer totals, retire
  // the cart. The stock was moved by the reservation above, so these are post-commit
  // bookkeeping and best-effort — a hiccup must not undo the placed order.
  try {
    if (reservedLines.length > 0) {
      await logOrderDecrements(storeId, reservedLines, order._id);
    }
    // Customer lifetime value grows by the order's GROSS total (goods + shipping + tax),
    // not the gift-card-net charge — matching Shopify's `total_spent` so segments
    // (min_spent) and LTV analytics aren't understated when a gift card is used.
    await recordCustomerOrder(storeId, customerId, grossTotal);
    // Discount usage was already claimed atomically at apply time (no post-order $inc).
    if (input.sessionId) await markCartConverted(storeId, input.sessionId);
  } catch {
    /* order is already placed; post-steps are best-effort */
  }

  // 8. Order-confirmation email (Stage 13, PRD §11). Fire-and-forget from the
  //    order's perspective: `sendOrderConfirmation` never throws and the order is
  //    already persisted, so a mail failure can't undo it. It's awaited (not
  //    detached) so the send actually completes before a serverless lambda
  //    freezes; it no-ops when Resend is unconfigured (`isEmailConfigured()`).
  //    The store is loaded here only for branding (name, subdomain, contact).
  try {
    if (store) await sendOrderConfirmation(store, order);
  } catch {
    /* notification is best-effort; never blocks the placed order */
  }

  return {
    orderId: order._id,
    orderNumber,
    subtotal,
    discountAmount,
    shippingTotal,
    shippingMethod: shipping.label,
    taxTotal,
    giftCardAmount,
    total,
    lineItems,
  };
}
