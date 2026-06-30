import type { Product, ProductInput, ProductStatus, Variant } from "@/types";
import type { ParsedProductRow } from "./csv";
import { mockProducts } from "./mocks";
import { resolve, scoped } from "./_util";
import { isDbConfigured, Products } from "@/lib/db";
import { cachedByStore } from "@/lib/cache/cached";
import { productsTag, productTag } from "@/lib/cache/tags";

export type { ProductInput } from "@/types";

/** All products for a store (PRD §6.4). Optionally filter by status. */
export async function getProducts(
  storeId: string,
  opts?: { status?: Product["status"] },
): Promise<Product[]> {
  if (!isDbConfigured()) {
    let rows = scoped(mockProducts, storeId);
    if (opts?.status) rows = rows.filter((p) => p.status === opts.status);
    return resolve(rows);
  }
  // Bounded discriminator: status is the only variable (a small enum) → no key blowup.
  return cachedByStore(
    storeId,
    "products-list",
    [opts?.status ?? "all"],
    [productsTag(storeId)],
    () => Products.findMany(storeId, opts?.status ? { status: opts.status } : {}),
  );
}

/** A single product by Mongo id, scoped to the store. */
export async function getProduct(storeId: string, id: string): Promise<Product | null> {
  if (!isDbConfigured()) {
    const found = scoped(mockProducts, storeId).find((p) => p._id === id);
    return found ? resolve(found) : null;
  }
  return Products.findById(storeId, id);
}

/** A single product by URL handle (unique per store). */
export async function getProductByHandle(
  storeId: string,
  handle: string,
): Promise<Product | null> {
  if (!isDbConfigured()) {
    const found = scoped(mockProducts, storeId).find((p) => p.handle === handle);
    return found ? resolve(found) : null;
  }
  // Per-handle tag so a single product write busts just its PDP entry. skipNull so
  // a not-yet-created handle isn't pinned as a 404 until the TTL.
  return cachedByStore(
    storeId,
    "product-by-handle",
    [handle],
    [productTag(storeId, handle), productsTag(storeId)],
    () => Products.findOne(storeId, { handle }),
    { skipNull: true },
  );
}

export type ProductSort = "newest" | "price_asc" | "price_desc" | "title";

export interface ProductQuery {
  /** Free-text — matches title, tags, type, or vendor (case-insensitive). */
  q?: string;
  /** Exact tag facet. */
  tag?: string;
  /** Exact product-type facet. */
  productType?: string;
  status?: ProductStatus;
  sort?: ProductSort;
}

/** Lowest variant price — the figure browse pages sort/display "from". */
export function minVariantPrice(p: Product): number {
  return p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : 0;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortProducts(rows: Product[], sort?: ProductSort): Product[] {
  const out = [...rows];
  switch (sort) {
    case "price_asc":
      return out.sort((a, b) => minVariantPrice(a) - minVariantPrice(b));
    case "price_desc":
      return out.sort((a, b) => minVariantPrice(b) - minVariantPrice(a));
    case "title":
      return out.sort((a, b) => a.title.localeCompare(b.title));
    case "newest":
    default:
      return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
}

/**
 * Search + facet-filter products (storefront browse / `/search`). Matches `q` across
 * title/tags/type/vendor and narrows by exact `tag` / `productType`. Pass
 * `status: "active"` for storefront use so drafts never surface.
 */
export async function searchProducts(storeId: string, query: ProductQuery): Promise<Product[]> {
  const q = query.q?.trim();

  if (!isDbConfigured()) {
    let rows = scoped(mockProducts, storeId);
    if (query.status) rows = rows.filter((p) => p.status === query.status);
    if (query.productType) rows = rows.filter((p) => p.productType === query.productType);
    if (query.tag) rows = rows.filter((p) => (p.tags ?? []).includes(query.tag!));
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((p) =>
        [p.title, p.productType ?? "", p.vendor ?? "", ...(p.tags ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    }
    return resolve(sortProducts(rows, query.sort));
  }

  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.productType) filter.productType = query.productType;
  if (query.tag) filter.tags = query.tag;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ title: rx }, { tags: rx }, { productType: rx }, { vendor: rx }];
  }

  const run = async () => sortProducts(await Products.findMany(storeId, filter), query.sort);

  // DO NOT cache free-text search: arbitrary `q` = unbounded key cardinality, a
  // cache-blowup / memory-amplification risk. Only the BOUNDED faceted reads
  // (status / tag / productType / sort — all small enums or finite facets) are
  // cached. Free-text falls through to a live DB query every time.
  if (q) return run();

  // Stable serialization of the bounded facet set so two equivalent queries hit
  // the same key regardless of object key order.
  const discriminator = JSON.stringify({
    status: query.status ?? null,
    productType: query.productType ?? null,
    tag: query.tag ?? null,
    sort: query.sort ?? null,
  });
  return cachedByStore(
    storeId,
    "products-search",
    [discriminator],
    [productsTag(storeId)],
    run,
  );
}

/** Distinct active-product facets for the storefront filter UI (types + tags). */
export async function getProductFacets(
  storeId: string,
): Promise<{ productTypes: string[]; tags: string[] }> {
  const rows = await getProducts(storeId, { status: "active" });
  const types = new Set<string>();
  const tags = new Set<string>();
  for (const p of rows) {
    if (p.productType) types.add(p.productType);
    for (const t of p.tags ?? []) if (t) tags.add(t);
  }
  return {
    productTypes: [...types].sort((a, b) => a.localeCompare(b)),
    tags: [...tags].sort((a, b) => a.localeCompare(b)),
  };
}

/** Resolve an ordered list of products by id (e.g. a featured_products section). */
export async function getProductsByIds(storeId: string, ids: string[]): Promise<Product[]> {
  if (!isDbConfigured()) {
    const rows = scoped(mockProducts, storeId);
    const byId = new Map(rows.map((p) => [p._id, p]));
    const ordered = ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
    return resolve(ordered);
  }
  // Bounded: the id list comes from a section config (featured_products), not free
  // user input — a stable join keys it. Order is reapplied after the cached fetch.
  const discriminator = [...ids].sort().join(",");
  const rows = await cachedByStore(
    storeId,
    "products-by-ids",
    [discriminator],
    [productsTag(storeId)],
    () => Products.findMany(storeId, { _id: { $in: ids } }),
  );
  // Preserve the caller's requested order (Mongo returns natural order).
  const byId = new Map(rows.map((p) => [p._id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
}

/* ============================================================
   Writes (Stage 9, PRD §6.4) — CRUD + bulk + duplicate.
   In mock mode (no DB) writes can't persist; they synthesize a plausible result
   so the Part-A demo flow still completes. With a DB they go through the
   tenant-scoped `Products` repository (storeId enforced, PRD §9).
   ============================================================ */

const now = () => new Date().toISOString();

/** Create a product. Throws `HANDLE_TAKEN` on a duplicate handle (unique index). */
export async function createProduct(storeId: string, input: ProductInput): Promise<Product> {
  if (!isDbConfigured()) {
    const stamp = now();
    return resolve({
      ...input,
      _id: `p_${Math.random().toString(36).slice(2, 10)}`,
      storeId,
      createdAt: stamp,
      updatedAt: stamp,
    } as Product);
  }
  try {
    return await Products.create(storeId, { ...input });
  } catch (err) {
    throw mapHandleClash(err);
  }
}

/** Update a product by id (scoped). Returns null if it isn't this store's. */
export async function updateProduct(
  storeId: string,
  id: string,
  input: ProductInput,
): Promise<Product | null> {
  if (!isDbConfigured()) {
    const found = scoped(mockProducts, storeId).find((p) => p._id === id);
    if (!found) return null;
    return resolve({ ...found, ...input, updatedAt: now() } as Product);
  }
  try {
    return await Products.updateOne(storeId, { _id: id }, { $set: { ...input } });
  } catch (err) {
    throw mapHandleClash(err);
  }
}

export async function deleteProduct(storeId: string, id: string): Promise<boolean> {
  if (!isDbConfigured()) return true;
  return Products.deleteOne(storeId, { _id: id });
}

/** Bulk set status for many products (index bulk bar). Returns count changed. */
export async function setProductsStatus(
  storeId: string,
  ids: string[],
  status: ProductStatus,
): Promise<number> {
  if (ids.length === 0) return 0;
  if (!isDbConfigured()) return ids.length;
  let n = 0;
  for (const id of ids) {
    const ok = await Products.updateOne(storeId, { _id: id }, { $set: { status } });
    if (ok) n++;
  }
  return n;
}

export async function deleteProducts(storeId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  if (!isDbConfigured()) return ids.length;
  let n = 0;
  for (const id of ids) {
    if (await Products.deleteOne(storeId, { _id: id })) n++;
  }
  return n;
}

/** Duplicate a product as a draft with a unique handle + fresh variant ids. */
export async function duplicateProduct(storeId: string, id: string): Promise<Product | null> {
  const source = await getProduct(storeId, id);
  if (!source) return null;
  const copy: ProductInput = {
    title: `${source.title} (copy)`,
    description: source.description,
    images: [...source.images],
    status: "draft",
    handle: await uniqueHandle(storeId, `${source.handle}-copy`),
    productType: source.productType ?? "",
    vendor: source.vendor ?? "",
    tags: [...(source.tags ?? [])],
    attributes: (source.attributes ?? []).map((a) => ({ ...a })),
    seo: { ...source.seo },
    options: source.options.map((o) => ({ ...o, values: [...o.values] })),
    variants: source.variants.map((v, i) => freshVariant(v, i)),
  };
  return createProduct(storeId, copy);
}

function freshVariant(v: Variant, i: number): Variant {
  return {
    ...v,
    id: `v_${Math.random().toString(36).slice(2, 8)}${i}`,
    inventory: { ...v.inventory },
  };
}

/** Find a handle that doesn't collide, appending -2, -3, … as needed. */
async function uniqueHandle(storeId: string, base: string): Promise<string> {
  if (!isDbConfigured()) return base;
  let candidate = base;
  for (let n = 2; n < 1000; n++) {
    const clash = await Products.findOne(storeId, { handle: candidate });
    if (!clash) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

/** A duplicate-key error on the (storeId, handle) unique index → a typed signal. */
function mapHandleClash(err: unknown): Error {
  if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
    return new Error("HANDLE_TAKEN");
  }
  return err instanceof Error ? err : new Error("Product write failed");
}

/* ============================================================
   Related products (Phase 4) — pure relevance scoring + lookup.
   ============================================================ */

/**
 * Relevance of `other` to `base`: same product type is the strongest signal, then
 * each shared tag, then same vendor. Pure + deterministic so it's unit-tested and
 * reused anywhere a "you may also like" rail is needed.
 */
export function relatedScore(base: Product, other: Product): number {
  if (other._id === base._id) return 0;
  let score = 0;
  if (base.productType && other.productType === base.productType) score += 3;
  const baseTags = new Set((base.tags ?? []).map((t) => t.toLowerCase()));
  for (const t of other.tags ?? []) if (baseTags.has(t.toLowerCase())) score += 1;
  if (base.vendor && other.vendor === base.vendor) score += 1;
  return score;
}

/** Top-N active products related to `base` from a candidate pool (highest score first). */
export function relatedProducts(base: Product, pool: Product[], limit = 4): Product[] {
  return pool
    .filter((p) => p._id !== base._id && p.status === "active")
    .map((p) => ({ p, s: relatedScore(base, p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (a.p.createdAt < b.p.createdAt ? 1 : -1))
    .slice(0, limit)
    .map((x) => x.p);
}

/** Resolve related products for a storefront PDP. */
export async function getRelatedProducts(
  storeId: string,
  product: Product,
  limit = 4,
): Promise<Product[]> {
  const pool = await getProducts(storeId, { status: "active" });
  return relatedProducts(product, pool, limit);
}

/* ============================================================
   Bulk edit (Phase 4) — apply one set of changes across many products.
   ============================================================ */

export interface BulkProductEdit {
  status?: ProductStatus;
  productType?: string;
  vendor?: string;
  addTags?: string[];
  removeTags?: string[];
  /** Adjust every variant price by this percent (e.g. +10 / −15). */
  priceAdjustPct?: number;
}

/** Compute the product fields a bulk edit changes (pure — used by tests + the writer). */
export function applyBulkEdit(product: Product, edit: BulkProductEdit): Partial<ProductInput> {
  const patch: Partial<ProductInput> = {};
  if (edit.status) patch.status = edit.status;
  if (edit.productType !== undefined) patch.productType = edit.productType;
  if (edit.vendor !== undefined) patch.vendor = edit.vendor;

  if (edit.addTags?.length || edit.removeTags?.length) {
    const remove = new Set((edit.removeTags ?? []).map((t) => t.toLowerCase()));
    const tags = (product.tags ?? []).filter((t) => !remove.has(t.toLowerCase()));
    for (const t of edit.addTags ?? []) {
      if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t);
    }
    patch.tags = tags;
  }

  if (edit.priceAdjustPct) {
    const factor = 1 + edit.priceAdjustPct / 100;
    patch.variants = product.variants.map((v) => ({
      ...v,
      price: Math.max(0, Math.round(v.price * factor * 100) / 100),
    }));
  }
  return patch;
}

/** Apply a bulk edit to many products. Returns the count changed. */
export async function bulkEditProducts(
  storeId: string,
  ids: string[],
  edit: BulkProductEdit,
): Promise<number> {
  if (ids.length === 0) return 0;
  if (!isDbConfigured()) return ids.length;
  let n = 0;
  for (const id of ids) {
    const product = await Products.findById(storeId, id);
    if (!product) continue;
    const patch = applyBulkEdit(product, edit);
    if (Object.keys(patch).length === 0) continue;
    const ok = await Products.updateOne(storeId, { _id: id }, { $set: patch });
    if (ok) n++;
  }
  return n;
}

/* ============================================================
   CSV import (Phase 4) — upsert by handle; single primary variant per row.
   ============================================================ */

function rowVariant(row: ParsedProductRow, existing?: Variant): Variant {
  return {
    id: existing?.id ?? `v_${Math.random().toString(36).slice(2, 8)}`,
    title: existing?.title ?? "Default",
    sku: row.sku,
    barcode: row.barcode,
    price: row.price,
    compareAtPrice: row.compareAtPrice,
    inventory: {
      quantity: row.quantity,
      policy: existing?.inventory.policy ?? "deny",
      lowStockThreshold: existing?.inventory.lowStockThreshold ?? 0,
      trackInventory: existing?.inventory.trackInventory ?? true,
    },
  };
}

export interface ImportSummary {
  created: number;
  updated: number;
  errors: string[];
}

/**
 * Upsert parsed CSV rows by handle: existing products are patched (and their primary
 * variant updated), new handles are created with a single default variant. Note: this
 * is the one-variant-per-row MVP model — multi-variant products keep their extra
 * variants on update but only the first is touched by import.
 */
export async function importProducts(
  storeId: string,
  rows: ParsedProductRow[],
): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, updated: 0, errors: [] };
  if (!isDbConfigured()) {
    summary.errors.push("Import needs a database connection (not available in demo mode).");
    return summary;
  }

  for (const row of rows) {
    try {
      const existing = await Products.findOne(storeId, { handle: row.handle });
      if (existing) {
        const variants = existing.variants.length
          ? [rowVariant(row, existing.variants[0]), ...existing.variants.slice(1)]
          : [rowVariant(row)];
        await Products.updateOne(
          storeId,
          { _id: existing._id },
          {
            $set: {
              title: row.title,
              description: row.description,
              status: row.status,
              productType: row.productType,
              vendor: row.vendor,
              tags: row.tags,
              variants,
            },
          },
        );
        summary.updated++;
      } else {
        await Products.create(storeId, {
          title: row.title,
          description: row.description,
          status: row.status,
          handle: row.handle,
          productType: row.productType,
          vendor: row.vendor,
          tags: row.tags,
          attributes: [],
          seo: {},
          options: [],
          images: [],
          variants: [rowVariant(row)],
        });
        summary.created++;
      }
    } catch {
      summary.errors.push(`"${row.handle}": write failed (skipped).`);
    }
  }
  return summary;
}
