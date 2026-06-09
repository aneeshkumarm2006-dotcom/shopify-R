import { Schema } from "mongoose";
import { baseSchemaOptions, defineModel, stringId } from "./_shared";

/* ============================================================
   5.4 products (+ embedded Variant / Option)
   ============================================================ */
const VariantInventorySchema = new Schema(
  {
    quantity: { type: Number, default: 0 },
    policy: { type: String, enum: ["deny", "continue"], default: "deny" },
    lowStockThreshold: { type: Number, default: 0 },
    trackInventory: { type: Boolean, default: true },
  },
  { _id: false },
);

const VariantSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    sku: { type: String, default: "" },
    barcode: { type: String },
    price: { type: Number, required: true },
    compareAtPrice: { type: Number, default: null },
    inventory: { type: VariantInventorySchema, default: () => ({}) },
  },
  { _id: false },
);

const ProductOptionSchema = new Schema(
  {
    name: { type: String, required: true },
    values: { type: [String], default: [] },
  },
  { _id: false },
);

const ProductSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" }, // rich text / HTML
    images: { type: [String], default: [] }, // Cloudinary URLs
    status: { type: String, enum: ["active", "draft"], default: "draft" },
    handle: { type: String, required: true }, // unique per store (compound index below)
    seo: { type: Schema.Types.Mixed, default: () => ({}) },
    options: { type: [ProductOptionSchema], default: [] },
    variants: { type: [VariantSchema], default: [] },
  },
  baseSchemaOptions,
);
// Unique slug per tenant; storeId-leading so scoped reads use the index.
ProductSchema.index({ storeId: 1, handle: 1 }, { unique: true });
ProductSchema.index({ storeId: 1, status: 1 });

/* ============================================================
   5.5 collections (light, manual grouping)
   ============================================================ */
const CollectionSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    title: { type: String, required: true },
    handle: { type: String, required: true },
    productIds: { type: [String], default: [] }, // manual membership (no smart rules)
  },
  baseSchemaOptions,
);
CollectionSchema.index({ storeId: 1, handle: 1 }, { unique: true });

/* ============================================================
   5.6 inventoryAdjustments (audit log)
   ============================================================ */
const InventoryAdjustmentSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    productId: { type: String, required: true },
    variantId: { type: String, required: true },
    delta: { type: Number, required: true }, // +received / −sold / ±correction
    reason: { type: String, enum: ["order", "manual", "correction", "restock"], required: true },
    resultingQuantity: { type: Number, required: true }, // snapshot after adjustment
    orderId: { type: String }, // when reason = "order"
  },
  baseSchemaOptions,
);
InventoryAdjustmentSchema.index({ storeId: 1, productId: 1 });

export const ProductModel = defineModel("Product", ProductSchema);
export const CollectionModel = defineModel("Collection", CollectionSchema);
export const InventoryAdjustmentModel = defineModel("InventoryAdjustment", InventoryAdjustmentSchema);
