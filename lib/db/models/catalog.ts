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

const ProductAttributeSchema = new Schema(
  {
    name: { type: String, required: true },
    value: { type: String, default: "" },
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
    productType: { type: String, default: "" }, // browse/filter category
    vendor: { type: String, default: "" }, // brand / cultivator
    tags: { type: [String], default: [] }, // search + facets
    attributes: { type: [ProductAttributeSchema], default: [] }, // THC %, strain, …
    seo: { type: Schema.Types.Mixed, default: () => ({}) },
    options: { type: [ProductOptionSchema], default: [] },
    variants: { type: [VariantSchema], default: [] },
  },
  baseSchemaOptions,
);
// Unique slug per tenant; storeId-leading so scoped reads use the index.
ProductSchema.index({ storeId: 1, handle: 1 }, { unique: true });
ProductSchema.index({ storeId: 1, status: 1 });
// Facet filters (storefront browse): productType + tags, scoped per store.
ProductSchema.index({ storeId: 1, productType: 1 });
ProductSchema.index({ storeId: 1, tags: 1 });

/* ============================================================
   5.5 collections (light, manual grouping)
   ============================================================ */
const CollectionRuleSchema = new Schema(
  {
    field: { type: String, enum: ["tag", "productType", "vendor", "title", "price"], required: true },
    op: {
      type: String,
      enum: ["equals", "not_equals", "contains", "starts_with", "gt", "lt"],
      required: true,
    },
    value: { type: String, default: "" },
  },
  { _id: false },
);

const CollectionRuleSetSchema = new Schema(
  {
    match: { type: String, enum: ["all", "any"], default: "all" },
    conditions: { type: [CollectionRuleSchema], default: [] },
  },
  { _id: false },
);

const CollectionSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    title: { type: String, required: true },
    handle: { type: String, required: true },
    kind: { type: String, enum: ["manual", "smart"], default: "manual" },
    productIds: { type: [String], default: [] }, // manual membership
    rules: { type: CollectionRuleSetSchema, default: null }, // smart membership
  },
  baseSchemaOptions,
);
CollectionSchema.index({ storeId: 1, handle: 1 }, { unique: true });

/* ============================================================
   Product reviews / ratings (Phase 4)
   ============================================================ */
const ReviewSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    productId: { type: String, required: true },
    customerId: { type: String, default: null },
    authorName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    status: { type: String, enum: ["published", "pending", "hidden"], default: "published" },
  },
  baseSchemaOptions,
);
ReviewSchema.index({ storeId: 1, productId: 1, status: 1 });
ReviewSchema.index({ storeId: 1, createdAt: -1 });

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

/* ============================================================
   Inventory levels (Phase 6) — per-(variant, location) stock.
   ============================================================ */
const InventoryLevelSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    productId: { type: String, required: true },
    variantId: { type: String, required: true },
    locationId: { type: String, required: true },
    quantity: { type: Number, default: 0 },
  },
  baseSchemaOptions,
);
InventoryLevelSchema.index({ storeId: 1, productId: 1, variantId: 1, locationId: 1 }, { unique: true });
InventoryLevelSchema.index({ storeId: 1, locationId: 1 });

export const ProductModel = defineModel("Product", ProductSchema);
export const CollectionModel = defineModel("Collection", CollectionSchema);
export const ReviewModel = defineModel("Review", ReviewSchema);
export const InventoryAdjustmentModel = defineModel("InventoryAdjustment", InventoryAdjustmentSchema);
export const InventoryLevelModel = defineModel("InventoryLevel", InventoryLevelSchema);
