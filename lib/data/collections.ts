import type { Collection, CollectionInput, Product } from "@/types";
import { mockCollections, mockProducts } from "./mocks";
import { resolve, scoped } from "./_util";
import { isDbConfigured, Collections, Products } from "@/lib/db";

export type { CollectionInput } from "@/types";

export async function getCollections(storeId: string): Promise<Collection[]> {
  if (!isDbConfigured()) return resolve(scoped(mockCollections, storeId));
  return Collections.findMany(storeId);
}

export async function getCollection(storeId: string, handle: string): Promise<Collection | null> {
  if (!isDbConfigured()) {
    const found = scoped(mockCollections, storeId).find((c) => c.handle === handle);
    return found ? resolve(found) : null;
  }
  return Collections.findOne(storeId, { handle });
}

/** A single collection by Mongo id, scoped to the store (admin editor). */
export async function getCollectionById(
  storeId: string,
  id: string,
): Promise<Collection | null> {
  if (!isDbConfigured()) {
    const found = scoped(mockCollections, storeId).find((c) => c._id === id);
    return found ? resolve(found) : null;
  }
  return Collections.findById(storeId, id);
}

/** The collection ids a given product currently belongs to (for the editor). */
export async function getCollectionIdsForProduct(
  storeId: string,
  productId: string,
): Promise<string[]> {
  if (!isDbConfigured()) {
    return scoped(mockCollections, storeId)
      .filter((c) => c.productIds.includes(productId))
      .map((c) => c._id);
  }
  const rows = await Collections.findMany(storeId, { productIds: productId });
  return rows.map((c) => c._id);
}

/** Products belonging to a collection (manual membership, PRD §5.5). */
export async function getCollectionProducts(
  storeId: string,
  handle: string,
): Promise<Product[]> {
  if (!isDbConfigured()) {
    const collection = scoped(mockCollections, storeId).find((c) => c.handle === handle);
    if (!collection) return resolve([]);
    const rows = scoped(mockProducts, storeId);
    const byId = new Map(rows.map((p) => [p._id, p]));
    const members = collection.productIds
      .map((id) => byId.get(id))
      .filter((p): p is Product => Boolean(p));
    return resolve(members);
  }

  const collection = await Collections.findOne(storeId, { handle });
  if (!collection) return [];
  const rows = await Products.findMany(storeId, { _id: { $in: collection.productIds } });
  // Preserve curated membership order.
  const byId = new Map(rows.map((p) => [p._id, p]));
  return collection.productIds
    .map((id) => byId.get(id))
    .filter((p): p is Product => Boolean(p));
}

/* ============================================================
   Writes (Stage 9, PRD §5.5) — manual grouping CRUD + membership sync.
   ============================================================ */

const stamp = () => new Date().toISOString();

export async function createCollection(
  storeId: string,
  input: CollectionInput,
): Promise<Collection> {
  if (!isDbConfigured()) {
    const at = stamp();
    return resolve({
      ...input,
      _id: `col_${Math.random().toString(36).slice(2, 10)}`,
      storeId,
      createdAt: at,
      updatedAt: at,
    } as Collection);
  }
  try {
    return await Collections.create(storeId, { ...input });
  } catch (err) {
    throw mapCollectionHandleClash(err);
  }
}

export async function updateCollection(
  storeId: string,
  id: string,
  input: CollectionInput,
): Promise<Collection | null> {
  if (!isDbConfigured()) {
    const found = scoped(mockCollections, storeId).find((c) => c._id === id);
    return found ? resolve({ ...found, ...input, updatedAt: stamp() } as Collection) : null;
  }
  try {
    return await Collections.updateOne(storeId, { _id: id }, { $set: { ...input } });
  } catch (err) {
    throw mapCollectionHandleClash(err);
  }
}

export async function deleteCollection(storeId: string, id: string): Promise<boolean> {
  if (!isDbConfigured()) return true;
  return Collections.deleteOne(storeId, { _id: id });
}

/**
 * Reconcile which collections a product belongs to: add it to `collectionIds`
 * and remove it from every other collection (PRD §5.5 manual membership). Used by
 * the product editor's Collections picker so membership stays consistent without
 * the merchant opening each collection.
 */
export async function setProductCollections(
  storeId: string,
  productId: string,
  collectionIds: string[],
): Promise<void> {
  if (!isDbConfigured()) return;
  const want = new Set(collectionIds);
  const all = await Collections.findMany(storeId);
  for (const c of all) {
    const has = c.productIds.includes(productId);
    if (want.has(c._id) && !has) {
      await Collections.updateOne(storeId, { _id: c._id }, { $addToSet: { productIds: productId } });
    } else if (!want.has(c._id) && has) {
      await Collections.updateOne(storeId, { _id: c._id }, { $pull: { productIds: productId } });
    }
  }
}

function mapCollectionHandleClash(err: unknown): Error {
  if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
    return new Error("HANDLE_TAKEN");
  }
  return err instanceof Error ? err : new Error("Collection write failed");
}
