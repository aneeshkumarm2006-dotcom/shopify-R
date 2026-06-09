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
    total: { type: Number, required: true },
    shippingAddress: { type: AddressSchema, required: true },
    contact: { type: AddressSchema, required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "refunded"], default: "pending" },
    fulfillmentStatus: {
      type: String,
      enum: ["unfulfilled", "fulfilled", "cancelled"],
      default: "unfulfilled",
    },
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

export const CartModel = defineModel("Cart", CartSchema);
export const OrderModel = defineModel("Order", OrderSchema);
export const CustomerModel = defineModel("Customer", CustomerSchema);
