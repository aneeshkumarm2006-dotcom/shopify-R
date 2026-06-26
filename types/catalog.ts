import type { Id, Timestamps } from "./common";

/* ============================================================
   5.4 products (+ embedded Variant / Option)
   ============================================================ */
export type ProductStatus = "active" | "draft";

/** Out-of-stock behavior: `deny` stops selling at 0; `continue` allows overselling. */
export type InventoryPolicy = "deny" | "continue";

export interface VariantInventory {
  quantity: number;
  policy: InventoryPolicy;
  lowStockThreshold: number;
  trackInventory: boolean;
}

export interface Variant {
  id: Id;
  title: string;
  sku: string;
  barcode?: string;
  price: number;
  compareAtPrice?: number | null;
  inventory: VariantInventory;
}

export interface ProductOption {
  name: string; // e.g. "Size" | "Strength"
  values: string[]; // e.g. ["S", "M"]
}

export interface ProductSeo {
  title?: string;
  description?: string; // overrides store seoDefaults
}

/**
 * A structured custom attribute — the niche merchandising data Shopify needs an app
 * for (e.g. THC %, strain, dosage, terpenes). Free-form name/value so merchants in
 * any vertical can describe their catalog; rendered on the PDP and usable as facets.
 */
export interface ProductAttribute {
  name: string; // e.g. "THC", "Strain"
  value: string; // e.g. "24%", "Sativa"
}

export interface Product extends Timestamps {
  _id: Id;
  storeId: Id;
  title: string;
  description: string; // rich text / HTML
  images: string[]; // Cloudinary URLs
  status: ProductStatus;
  handle: string; // URL slug, unique per store
  /** Single product category for browse/filter (e.g. "Flower", "Edibles"). */
  productType?: string;
  /** Brand / cultivator. */
  vendor?: string;
  /** Free-form labels for search + faceting. */
  tags?: string[];
  /** Structured custom attributes (THC %, strain, …) — display + facets. */
  attributes?: ProductAttribute[];
  seo: ProductSeo;
  options: ProductOption[]; // optional
  variants: Variant[];
}

/** Writable product fields (everything the editor controls). `_id`/`storeId`/
 *  timestamps are owned by the data layer, never the caller. Lives in `types/`
 *  so client components can import it without reaching the server data layer. */
export type ProductInput = Omit<Product, "_id" | "storeId" | "createdAt" | "updatedAt">;

/** Writable collection fields — title · handle · membership mode + rules (Phase 4).
 *  `kind`/`rules` are optional so manual-collection callers stay terse (kind defaults
 *  to "manual" at the schema layer). */
export type CollectionInput = Pick<Collection, "title" | "handle" | "productIds"> &
  Partial<Pick<Collection, "kind" | "rules">>;

/* ============================================================
   5.5 collections (manual grouping OR smart/automated rules)
   ============================================================ */
/** How a collection decides membership. `manual` = curated list; `smart` = rules. */
export type CollectionKind = "manual" | "smart";

/** Product fields a smart-collection rule can test. */
export type CollectionRuleField = "tag" | "productType" | "vendor" | "title" | "price";

/** Comparison operators (string fields use text ops; `price` uses numeric ops). */
export type CollectionRuleOp =
  | "equals"
  | "not_equals"
  | "contains"
  | "starts_with"
  | "gt"
  | "lt";

export interface CollectionRule {
  field: CollectionRuleField;
  op: CollectionRuleOp;
  value: string; // numeric ops parse this; text ops compare case-insensitively
}

/** A rule set: match ALL conditions (AND) or ANY (OR). */
export interface CollectionRuleSet {
  match: "all" | "any";
  conditions: CollectionRule[];
}

export interface Collection extends Timestamps {
  _id: Id;
  storeId: Id;
  title: string;
  handle: string;
  kind: CollectionKind; // "manual" (default) | "smart"
  productIds: Id[]; // manual membership (ignored for smart collections)
  rules?: CollectionRuleSet; // smart membership (ignored for manual collections)
}

/* ============================================================
   Product reviews / ratings (Phase 4) — storefront UGC, per store.
   ============================================================ */
export type ReviewStatus = "published" | "pending" | "hidden";

export interface Review extends Timestamps {
  _id: Id;
  storeId: Id;
  productId: Id;
  customerId?: Id | null; // set when a signed-in shopper authored it
  authorName: string;
  rating: number; // 1–5
  title?: string;
  body: string;
  status: ReviewStatus;
}

/** Aggregate rating for a product (PDP badge + sort). */
export interface RatingSummary {
  average: number; // rounded to 1 decimal; 0 when no reviews
  count: number;
}

/* ============================================================
   Inventory levels (Phase 6) — per-(variant, location) stock. The sum across a
   variant's levels is mirrored onto `variant.inventory.quantity` (the sellable total
   used at checkout), so multi-location is additive over the existing single-quantity model.
   ============================================================ */
export interface InventoryLevel extends Timestamps {
  _id: Id;
  storeId: Id;
  productId: Id;
  variantId: Id;
  locationId: Id;
  quantity: number;
}

/* ============================================================
   5.6 inventoryAdjustments (audit log)
   ============================================================ */
export type InventoryReason = "order" | "manual" | "correction" | "restock";

export interface InventoryAdjustment extends Timestamps {
  _id: Id;
  storeId: Id;
  productId: Id;
  variantId: Id;
  delta: number; // +received / −sold / ±correction
  reason: InventoryReason;
  resultingQuantity: number; // snapshot after adjustment
  orderId?: Id; // when reason = "order"
}
