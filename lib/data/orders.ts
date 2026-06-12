import type {
  Fulfillment,
  FulfillmentLine,
  FulfillmentStatus,
  Order,
  OrderLineItem,
  PaymentStatus,
} from "@/types";
import { mockOrders } from "./mocks";
import { resolve, scoped } from "./_util";
import { isDbConfigured, Orders } from "@/lib/db";

/** Orders for a store, newest first (PRD §6.7). */
export async function getOrders(storeId: string): Promise<Order[]> {
  if (!isDbConfigured()) {
    const rows = scoped(mockOrders, storeId).sort((a, b) => b.orderNumber - a.orderNumber);
    return resolve(rows);
  }
  return Orders.findMany(storeId, {}, { sort: { orderNumber: -1 } });
}

export async function getOrder(storeId: string, id: string): Promise<Order | null> {
  if (!isDbConfigured()) {
    const found = scoped(mockOrders, storeId).find((o) => o._id === id);
    return found ? resolve(found) : null;
  }
  return Orders.findById(storeId, id);
}

/** Orders placed by a given customer (for the customer detail screen). */
export async function getOrdersForCustomer(
  storeId: string,
  customerId: string,
): Promise<Order[]> {
  if (!isDbConfigured()) {
    const rows = scoped(mockOrders, storeId)
      .filter((o) => o.customerId === customerId)
      .sort((a, b) => b.orderNumber - a.orderNumber);
    return resolve(rows);
  }
  return Orders.findMany(storeId, { customerId }, { sort: { orderNumber: -1 } });
}

/* ============================================================
   Writes (Stage 10, PRD §6.6/§6.7). Order creation is orchestrated in
   `lib/data/checkout.ts` (customer match + inventory decrement + counter); this
   module owns the persistence of the order document itself and the merchant's
   manual status edits. All scoped through the `Orders` repository (PRD §9).
   ============================================================ */

/** The order document fields the checkout flow supplies (the rest are derived). */
export type NewOrder = Omit<Order, "_id" | "createdAt" | "updatedAt">;

/** Persist a new order. In mock mode (no DB) it echoes a plausible record. */
export async function createOrder(storeId: string, input: NewOrder): Promise<Order> {
  if (!isDbConfigured()) {
    const stamp = new Date().toISOString();
    return resolve({
      ...input,
      _id: `o_${Math.random().toString(36).slice(2, 10)}`,
      storeId,
      createdAt: stamp,
      updatedAt: stamp,
    });
  }
  // `storeId` is forced by the repository; strip the caller's copy to be explicit.
  const { storeId: _ignored, ...rest } = input;
  void _ignored;
  return Orders.create(storeId, { ...rest });
}

/**
 * Manually update an order's payment and/or fulfillment status (PRD §6.7). Only
 * the provided fields change. Returns the updated order, or null if it isn't this
 * store's. Mock mode synthesizes the patched order so the admin UI still flows.
 */
export async function updateOrderStatus(
  storeId: string,
  id: string,
  patch: { paymentStatus?: PaymentStatus; fulfillmentStatus?: FulfillmentStatus },
): Promise<Order | null> {
  const set: Record<string, unknown> = {};
  if (patch.paymentStatus) set.paymentStatus = patch.paymentStatus;
  if (patch.fulfillmentStatus) set.fulfillmentStatus = patch.fulfillmentStatus;
  if (Object.keys(set).length === 0) return getOrder(storeId, id);

  if (!isDbConfigured()) {
    const found = scoped(mockOrders, storeId).find((o) => o._id === id);
    if (!found) return null;
    return resolve({ ...found, ...patch, updatedAt: new Date().toISOString() });
  }
  return Orders.updateOne(storeId, { _id: id }, { $set: set });
}

/**
 * Reconcile an order's `paymentStatus` from a payment webhook (Stage 12, PRD §6.11).
 * The processor identifies the order by its `order.paymentIntent`, not our `_id`,
 * so this matches on the intent — still tenant-scoped by `storeId` (the store the
 * event carries in its intent metadata), so a webhook can't reach across tenants.
 * Returns the updated order, or null when no order in the store holds that intent.
 */
export async function setOrderPaymentStatusByIntent(
  storeId: string,
  paymentIntent: string,
  paymentStatus: PaymentStatus,
): Promise<Order | null> {
  if (!isDbConfigured()) {
    const found = scoped(mockOrders, storeId).find((o) => o.paymentIntent === paymentIntent);
    if (!found) return null;
    return resolve({ ...found, paymentStatus, updatedAt: new Date().toISOString() });
  }
  return Orders.updateOne(storeId, { paymentIntent }, { $set: { paymentStatus } });
}

/* ============================================================
   Fulfillment (Phase 3) — line-item/partial shipments + tracking.
   ============================================================ */

export interface FulfillInput {
  /** Which lines (by index into `order.lineItems`) and how many of each to ship. */
  lines: { lineIndex: number; quantity: number }[];
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
}

export class FulfillmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FulfillmentError";
  }
}

/** Derive the order's rollup status from per-line fulfilled quantities. */
function rollupFulfillment(lineItems: OrderLineItem[]): FulfillmentStatus {
  const total = lineItems.reduce((s, li) => s + li.quantity, 0);
  const done = lineItems.reduce((s, li) => s + (li.fulfilledQuantity ?? 0), 0);
  if (done <= 0) return "unfulfilled";
  if (done >= total) return "fulfilled";
  return "partially_fulfilled";
}

/**
 * Record a shipment against an order (PRD §6.7, Phase 3). Adds the requested
 * quantities to each line's `fulfilledQuantity` (clamped to what remains), appends a
 * `fulfillment` record carrying optional tracking, and recomputes the rollup
 * fulfillment status. Tenant-scoped via the `Orders` repo. Throws `FulfillmentError`
 * when the order is cancelled or nothing shippable was requested.
 */
export async function createFulfillment(
  storeId: string,
  orderId: string,
  input: FulfillInput,
): Promise<Order | null> {
  const order = await getOrder(storeId, orderId);
  if (!order) return null;
  if (order.fulfillmentStatus === "cancelled") {
    throw new FulfillmentError("This order is cancelled.");
  }

  const lineItems: OrderLineItem[] = order.lineItems.map((li) => ({
    ...li,
    fulfilledQuantity: li.fulfilledQuantity ?? 0,
  }));

  const recordLines: FulfillmentLine[] = [];
  for (const req of input.lines) {
    const li = lineItems[req.lineIndex];
    if (!li) continue;
    const remaining = li.quantity - (li.fulfilledQuantity ?? 0);
    const qty = Math.max(0, Math.min(Math.floor(req.quantity), remaining));
    if (qty <= 0) continue;
    li.fulfilledQuantity = (li.fulfilledQuantity ?? 0) + qty;
    recordLines.push({ lineIndex: req.lineIndex, quantity: qty });
  }
  if (recordLines.length === 0) {
    throw new FulfillmentError("Nothing left to fulfill on this order.");
  }

  const fulfillment: Fulfillment = {
    id: `f_${Math.random().toString(36).slice(2, 10)}`,
    lines: recordLines,
    ...(input.trackingNumber?.trim() ? { trackingNumber: input.trackingNumber.trim() } : {}),
    ...(input.carrier?.trim() ? { carrier: input.carrier.trim() } : {}),
    ...(input.trackingUrl?.trim() ? { trackingUrl: input.trackingUrl.trim() } : {}),
    createdAt: new Date().toISOString(),
  };
  const fulfillments = [...(order.fulfillments ?? []), fulfillment];
  const fulfillmentStatus = rollupFulfillment(lineItems);

  if (!isDbConfigured()) {
    return resolve({
      ...order,
      lineItems,
      fulfillments,
      fulfillmentStatus,
      updatedAt: new Date().toISOString(),
    });
  }
  return Orders.updateOne(
    storeId,
    { _id: orderId },
    { $set: { lineItems, fulfillments, fulfillmentStatus } },
  );
}
