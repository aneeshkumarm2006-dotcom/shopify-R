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

export interface Product extends Timestamps {
  _id: Id;
  storeId: Id;
  title: string;
  description: string; // rich text / HTML
  images: string[]; // Cloudinary URLs
  status: ProductStatus;
  handle: string; // URL slug, unique per store
  seo: ProductSeo;
  options: ProductOption[]; // optional
  variants: Variant[];
}

/** Writable product fields (everything the editor controls). `_id`/`storeId`/
 *  timestamps are owned by the data layer, never the caller. Lives in `types/`
 *  so client components can import it without reaching the server data layer. */
export type ProductInput = Omit<Product, "_id" | "storeId" | "createdAt" | "updatedAt">;

/** Writable collection fields — title · handle · manual membership (PRD §5.5). */
export type CollectionInput = Pick<Collection, "title" | "handle" | "productIds">;

/* ============================================================
   5.5 collections (light, manual grouping)
   ============================================================ */
export interface Collection extends Timestamps {
  _id: Id;
  storeId: Id;
  title: string;
  handle: string;
  productIds: Id[]; // manual membership — no smart/automated rules in MVP
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
