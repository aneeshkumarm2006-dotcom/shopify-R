import type { Address, OrderLineItem } from "@/types";
import { getProductsByIds } from "./products";
import { findOrCreateCustomer, recordCustomerOrder } from "./customers";
import { createOrder } from "./orders";
import { decrementInventory, type DecrementLine } from "./inventory";
import { markCartConverted } from "./cart";
import { getNextOrderNumber } from "./sequence";
import { getStore } from "./store";
import { createPaymentIntent } from "@/lib/payments";
import { sendOrderConfirmation } from "@/lib/email";

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
  const total = subtotal; // no tax/shipping engine in MVP (PRD §6.6)

  // 2. Match-or-create the customer by email within the store.
  const customer = await findOrCreateCustomer(storeId, {
    email: input.contact.email,
    name: input.contact.name,
    ...(input.contact.phone ? { phone: input.contact.phone } : {}),
    address: input.shippingAddress,
  });

  // 3. Atomic per-store order number.
  const orderNumber = await getNextOrderNumber(storeId);

  // 3b. Payment seam (Stage 12, PRD §6.11). In the MVP no processor is wired, so
  //     this returns null and the order settles offline as `pending`. A future
  //     high-risk processor mints a real intent here — its id is stamped on the
  //     order below and reconciled later via `/api/payments/webhook`.
  const intent = await createPaymentIntent(storeId, {
    amount: total,
    currency: input.currency ?? "$",
    customerEmail: input.contact.email,
  });

  // 4. Persist the order (pending by default, with frozen snapshots + age stamp).
  const order = await createOrder(storeId, {
    storeId,
    orderNumber,
    customerId: customer._id,
    lineItems,
    subtotal,
    total,
    shippingAddress: input.shippingAddress,
    contact: input.contact,
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
    const store = await getStore(storeId);
    if (store) await sendOrderConfirmation(store, order);
  } catch {
    /* notification is best-effort; never blocks the placed order */
  }

  return { orderId: order._id, orderNumber, total, lineItems };
}
