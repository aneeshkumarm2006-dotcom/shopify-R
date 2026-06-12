import type { Id, ISODate, Timestamps } from "./common";

/* ============================================================
   5.7 carts
   ============================================================ */
export type CartStatus = "active" | "converted" | "abandoned";

export interface CartItem {
  productId: Id;
  variantId: Id;
  quantity: number;
  priceSnapshot: number;
}

export interface Cart extends Timestamps {
  _id: Id;
  storeId: Id;
  sessionId: string; // cookie-based, anonymous
  items: CartItem[];
  status: CartStatus;
}

/* ============================================================
   5.8 orders
   ============================================================ */
export type PaymentStatus = "pending" | "paid" | "refunded";
export type FulfillmentStatus =
  | "unfulfilled"
  | "partially_fulfilled"
  | "fulfilled"
  | "cancelled";

/**
 * How an order is settled. `online` is the (stubbed) processor path; `cod` and
 * `in_store` are the high-risk-vertical money paths — orders stay `pending` until
 * the merchant marks them paid on delivery / at pickup.
 */
export type SettlementMethod = "online" | "cod" | "in_store";

/** Snapshot, never a live ref — frozen at order time (PRD §5.8 / §6.7). */
export interface OrderLineItem {
  title: string;
  variant: string;
  sku: string;
  price: number;
  quantity: number;
  /** How many of this line have shipped (partial fulfillment). Defaults to 0. */
  fulfilledQuantity?: number;
}

/** One shipment against an order — the quantities shipped + optional tracking. */
export interface FulfillmentLine {
  /** Index into the order's `lineItems`. */
  lineIndex: number;
  quantity: number;
}

export interface Fulfillment {
  id: string;
  lines: FulfillmentLine[];
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  createdAt: ISODate;
}

export interface Address {
  name: string;
  email: string;
  phone?: string;
  address: string;
}

export interface Order extends Timestamps {
  _id: Id;
  storeId: Id;
  orderNumber: number; // sequential per store
  customerId: Id; // → customers
  lineItems: OrderLineItem[];
  subtotal: number;
  /** Discount applied at checkout (0 when none). `total = subtotal - discountAmount`. */
  discountAmount?: number;
  /** The code that was applied, frozen on the order for the record. */
  discountCode?: string | null;
  total: number; // subtotal − discount (no tax/shipping engine in MVP)
  shippingAddress: Address;
  contact: Address;
  /** How the order is settled (defaults to `online` for back-compat). */
  settlementMethod?: SettlementMethod;
  paymentStatus: PaymentStatus; // `pending` default in MVP
  fulfillmentStatus: FulfillmentStatus;
  /** Shipment records (tracking + which lines shipped). Empty until fulfilled. */
  fulfillments?: Fulfillment[];
  ageVerifiedAt: ISODate; // timestamp the customer passed the gate
  /** Reserved payment seam (PRD §6.11) — wired to a high-risk processor later. */
  paymentIntent?: string | null;
}

/* ============================================================
   Discounts (promo codes) — applied server-side at checkout
   ============================================================ */
export type DiscountType = "percentage" | "fixed";
export type DiscountStatus = "active" | "disabled";

export interface Discount extends Timestamps {
  _id: Id;
  storeId: Id;
  code: string; // unique per store, stored uppercase
  type: DiscountType;
  /** Percentage (0–100) for `percentage`, or a currency amount for `fixed`. */
  value: number;
  /** Minimum order subtotal required to use the code (0 = no minimum). */
  minSubtotal: number;
  /** Max total redemptions across all customers; `null` = unlimited. */
  usageLimit?: number | null;
  /** How many times the code has been redeemed (denormalized). */
  usedCount: number;
  startsAt?: ISODate | null;
  endsAt?: ISODate | null;
  status: DiscountStatus;
}

/* ============================================================
   5.9 customers (scoped per store)
   ============================================================ */
export interface Customer extends Timestamps {
  _id: Id;
  storeId: Id; // a customer belongs to ONE store
  email: string; // unique per store, not globally
  name: string;
  phone?: string;
  addresses: Address[];
  orderCount: number; // denormalized for analytics
  totalSpent: number; // denormalized for analytics
}
