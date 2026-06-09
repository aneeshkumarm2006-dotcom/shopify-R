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
export type FulfillmentStatus = "unfulfilled" | "fulfilled" | "cancelled";

/** Snapshot, never a live ref — frozen at order time (PRD §5.8 / §6.7). */
export interface OrderLineItem {
  title: string;
  variant: string;
  sku: string;
  price: number;
  quantity: number;
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
  total: number; // no tax/shipping engine in MVP
  shippingAddress: Address;
  contact: Address;
  paymentStatus: PaymentStatus; // `pending` default in MVP
  fulfillmentStatus: FulfillmentStatus;
  ageVerifiedAt: ISODate; // timestamp the customer passed the gate
  /** Reserved payment seam (PRD §6.11) — wired to a high-risk processor later. */
  paymentIntent?: string | null;
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
