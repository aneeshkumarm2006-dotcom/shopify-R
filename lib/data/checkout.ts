import type { Address, OrderLineItem, SettlementMethod, Store } from "@/types";
import { getProductsByIds } from "./products";
import { findOrCreateCustomer, recordCustomerOrder } from "./customers";
import { createOrder } from "./orders";
import { decrementInventory, type DecrementLine } from "./inventory";
import { markCartConverted } from "./cart";
import { getNextOrderNumber } from "./sequence";
import { getStore } from "./store";
import { validateDiscount, redeemDiscount } from "./discounts";
import { createPaymentIntent } from "@/lib/payments";
import { sendOrderConfirmation } from "@/lib/email";

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
}

export interface PlacedOrder {
  orderId: string;
  orderNumber: number;
  total: number;
  lineItems: OrderLineItem[];
}

/** Raised when a checkout can't be fulfilled (empty cart, or no valid lines). */
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
  for (const line of input.lines) {
    const product = byId.get(line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant) continue; // dropped: not this store's, or stale
    const quantity = Math.max(1, Math.floor(line.quantity));
    lineItems.push({
      title: product.title,
      variant: product.variants.length > 1 ? variant.title : "",
      sku: variant.sku ?? "",
      price: variant.price,
      quantity,
    });
    if (variant.inventory.trackInventory) {
      decrements.push({ productId: product._id, variantId: variant.id, quantity });
    }
  }

  if (lineItems.length === 0) {
    throw new CheckoutError("None of the items in your cart are available.");
  }

  const subtotal = lineItems.reduce((sum, l) => sum + l.price * l.quantity, 0);

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
    if (result.ok) {
      discountAmount = result.amount;
      discountCode = result.code;
    }
  }
  const total = Math.max(0, subtotal - discountAmount);

  // 1d. Resolve + validate the settlement method against what the store offers.
  //     COD / in-store keep the order `pending` (merchant marks paid on delivery);
  //     `online` runs the (stubbed) processor seam below.
  const settlementMethod: SettlementMethod = input.settlementMethod ?? "online";
  if (store && !enabledSettlements(store)[settlementMethod]) {
    throw new CheckoutError("That payment method isn't available for this store.");
  }

  // 2. Match-or-create the customer by email within the store.
  const customer = await findOrCreateCustomer(storeId, {
    email: input.contact.email,
    name: input.contact.name,
    ...(input.contact.phone ? { phone: input.contact.phone } : {}),
    address: input.shippingAddress,
  });

  // 3. Atomic per-store order number.
  const orderNumber = await getNextOrderNumber(storeId);

  // 3b. Payment seam (Stage 12, PRD §6.11). Only the `online` method touches the
  //     processor; in the MVP it's stubbed and returns null, so the order settles
  //     offline as `pending`. COD / in-store skip the seam entirely and stay pending
  //     until the merchant marks them paid on delivery / at pickup.
  const intent =
    settlementMethod === "online"
      ? await createPaymentIntent(storeId, {
          amount: total,
          currency: input.currency ?? "$",
          customerEmail: input.contact.email,
        })
      : null;

  // 4. Persist the order (pending by default, with frozen snapshots + age stamp).
  const order = await createOrder(storeId, {
    storeId,
    orderNumber,
    customerId: customer._id,
    lineItems,
    subtotal,
    discountAmount,
    discountCode,
    total,
    shippingAddress: input.shippingAddress,
    contact: input.contact,
    settlementMethod,
    paymentStatus: intent?.status ?? "pending",
    fulfillmentStatus: "unfulfilled",
    ageVerifiedAt: input.ageVerifiedAt,
    paymentIntent: intent?.id ?? null,
  });

  // 5–7. Decrement stock, update customer totals, retire the cart. None of these
  // should undo the placed order if they hiccup, so failures are swallowed.
  try {
    if (decrements.length > 0) {
      await decrementInventory(storeId, decrements, order._id);
    }
    await recordCustomerOrder(storeId, customer._id, total);
    if (discountCode) await redeemDiscount(storeId, discountCode);
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

  return { orderId: order._id, orderNumber, total, lineItems };
}
