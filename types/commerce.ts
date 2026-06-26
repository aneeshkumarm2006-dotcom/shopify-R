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
  sessionId: string; // cookie-based, anonymous (or `cust:<id>` for a logged-in shopper)
  items: CartItem[];
  status: CartStatus;
  /** Recipient for abandoned-cart recovery (Phase 5) — captured when known. */
  email?: string | null;
  /** When a recovery email was sent (Phase 5); null/unset until then. */
  recoveryEmailedAt?: ISODate | null;
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

/** A single entry in an order's activity timeline (Phase 6). */
export type TimelineKind = "created" | "payment" | "fulfillment" | "status" | "note";

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  message: string;
  at: ISODate;
  actorId?: string | null; // merchant/staff user who triggered it (null = system)
}

export interface Order extends Timestamps {
  _id: Id;
  storeId: Id;
  orderNumber: number; // sequential per store
  /** Append-only activity log: creation, status edits, shipments, merchant notes. */
  timeline?: TimelineEntry[];
  customerId: Id; // → customers
  lineItems: OrderLineItem[];
  subtotal: number;
  /** Discount applied at checkout (0 when none). */
  discountAmount?: number;
  /** The code that was applied, frozen on the order for the record. */
  discountCode?: string | null;
  /** Shipping charged on the order (0 when free/unconfigured). Frozen at checkout. */
  shippingTotal?: number;
  /** The chosen shipping rate's label, frozen on the order (e.g. "Standard"). */
  shippingMethod?: string;
  /** Tax charged on the order (0 when no tax engine configured). Frozen at checkout. */
  taxTotal?: number;
  /** Gift-card code redeemed at checkout (Phase 4), frozen on the order. */
  giftCardCode?: string | null;
  /** Amount drawn from the gift card (reduces amount due), frozen at checkout. */
  giftCardAmount?: number;
  /** `total = (subtotal − discount) + shipping + tax − giftCard`, frozen at checkout. */
  total: number;
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
   Marketing campaigns (Phase 5) — one-off broadcasts to a customer segment.
   ============================================================ */
export type CampaignChannel = "email" | "sms";
export type CampaignStatus = "draft" | "sent";

/** Which customers a campaign / segment targets. */
export type SegmentType = "all" | "tag" | "has_ordered" | "no_orders" | "min_spent";

export interface Segment {
  type: SegmentType;
  /** Tag name for `tag`; numeric threshold (as string) for `min_spent`; else ignored. */
  value?: string;
}

export interface Campaign extends Timestamps {
  _id: Id;
  storeId: Id;
  name: string;
  channel: CampaignChannel;
  segment: Segment;
  subject: string; // email subject (unused for SMS)
  body: string; // plain message body (rendered into the marketing template for email)
  status: CampaignStatus;
  /** Recipients the send reached (denormalized after sending). */
  sentCount?: number;
  sentAt?: ISODate | null;
}

/* ============================================================
   Gift cards (Phase 4) — store-issued stored value, redeemed at checkout.
   ============================================================ */
export type GiftCardStatus = "active" | "disabled";

export interface GiftCard extends Timestamps {
  _id: Id;
  storeId: Id;
  code: string; // unique per store, stored uppercase
  initialBalance: number; // value issued
  balance: number; // remaining value
  currency: string;
  status: GiftCardStatus;
  note?: string; // who/why it was issued (merchant memo)
  expiresAt?: ISODate | null;
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
  /** Merchant-applied segmentation labels (Phase 5) — e.g. "vip", "wholesale". */
  tags?: string[];
  orderCount: number; // denormalized for analytics
  totalSpent: number; // denormalized for analytics
  /**
   * scrypt hash for storefront account login (Phase 3). Optional: a customer created
   * at checkout has none until they register/set a password. SERVER-ONLY — never
   * serialize to a client (use `PublicCustomer`).
   */
  passwordHash?: string;
}

/** A customer record safe to expose to client components (no `passwordHash`). */
export type PublicCustomer = Omit<Customer, "passwordHash">;
