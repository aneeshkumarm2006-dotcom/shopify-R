import { Schema } from "mongoose";
import { baseSchemaOptions, defineModel, stringId } from "./_shared";

const AddressSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    address: { type: String, required: true },
  },
  { _id: false },
);

/* ============================================================
   5.7 carts (session-scoped, anonymous)
   ============================================================ */
const CartItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    variantId: { type: String, required: true },
    quantity: { type: Number, required: true },
    priceSnapshot: { type: Number, required: true },
  },
  { _id: false },
);

const CartSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    sessionId: { type: String, required: true },
    items: { type: [CartItemSchema], default: [] },
    status: { type: String, enum: ["active", "converted", "abandoned"], default: "active" },
  },
  baseSchemaOptions,
);
CartSchema.index({ storeId: 1, sessionId: 1 });

/* ============================================================
   5.8 orders — line items are frozen snapshots, never live refs
   ============================================================ */
const OrderLineItemSchema = new Schema(
  {
    title: { type: String, required: true },
    variant: { type: String, default: "" },
    sku: { type: String, default: "" },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    fulfilledQuantity: { type: Number, default: 0 },
  },
  { _id: false },
);

const FulfillmentLineSchema = new Schema(
  { lineIndex: { type: Number, required: true }, quantity: { type: Number, required: true } },
  { _id: false },
);

const FulfillmentSchema = new Schema(
  {
    id: { type: String, required: true },
    lines: { type: [FulfillmentLineSchema], default: [] },
    trackingNumber: { type: String, default: "" },
    carrier: { type: String, default: "" },
    trackingUrl: { type: String, default: "" },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const OrderSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    orderNumber: { type: Number, required: true }, // sequential per store (atomic counter)
    customerId: { type: String, required: true },
    lineItems: { type: [OrderLineItemSchema], default: [] },
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    discountCode: { type: String, default: null },
    total: { type: Number, required: true },
    shippingAddress: { type: AddressSchema, required: true },
    contact: { type: AddressSchema, required: true },
    settlementMethod: {
      type: String,
      enum: ["online", "cod", "in_store"],
      default: "online",
    },
    paymentStatus: { type: String, enum: ["pending", "paid", "refunded"], default: "pending" },
    fulfillmentStatus: {
      type: String,
      enum: ["unfulfilled", "partially_fulfilled", "fulfilled", "cancelled"],
      default: "unfulfilled",
    },
    fulfillments: { type: [FulfillmentSchema], default: [] },
    ageVerifiedAt: { type: Date, required: true },
    paymentIntent: { type: String, default: null }, // reserved seam (PRD §6.11)
  },
  baseSchemaOptions,
);
OrderSchema.index({ storeId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index({ storeId: 1, customerId: 1 });

/* ============================================================
   5.9 customers (scoped per store; email unique per store, not globally)
   ============================================================ */
const CustomerSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    phone: { type: String },
    addresses: { type: [AddressSchema], default: [] },
    orderCount: { type: Number, default: 0 }, // denormalized for analytics
    totalSpent: { type: Number, default: 0 }, // denormalized for analytics
  },
  baseSchemaOptions,
);
CustomerSchema.index({ storeId: 1, email: 1 }, { unique: true });

/* ============================================================
   Discounts (promo codes) — scoped per store; code unique per store
   ============================================================ */
const DiscountSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    type: { type: String, enum: ["percentage", "fixed"], required: true },
    value: { type: Number, required: true },
    minSubtotal: { type: Number, default: 0 },
    usageLimit: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
  },
  baseSchemaOptions,
);
DiscountSchema.index({ storeId: 1, code: 1 }, { unique: true });

export const CartModel = defineModel("Cart", CartSchema);
export const OrderModel = defineModel("Order", OrderSchema);
export const CustomerModel = defineModel("Customer", CustomerSchema);
export const DiscountModel = defineModel("Discount", DiscountSchema);
