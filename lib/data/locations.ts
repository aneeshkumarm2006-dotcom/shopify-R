import type { InventoryLevel, Location } from "@/types";
import { isDbConfigured, Locations, InventoryLevels, Products, InventoryAdjustments } from "@/lib/db";

/**
 * Multi-location inventory (Phase 6). Stock is tracked per (variant, location); the SUM
 * across a variant's locations is mirrored onto `variant.inventory.quantity` — the
 * single sellable total checkout decrements — so multi-location is additive over the
 * existing model and never changes how selling works. Every store has a default
 * location (auto-created) where order decrements and untracked stock land.
 */

const SYNTHETIC_DEFAULT: Omit<Location, "createdAt" | "updatedAt"> = {
  _id: "loc_default",
  storeId: "",
  name: "Main location",
  isDefault: true,
};

/** Ensure the store has a default location, creating "Main location" if none exists. */
export async function ensureDefaultLocation(storeId: string): Promise<Location> {
  if (!isDbConfigured()) {
    const at = new Date().toISOString();
    return { ...SYNTHETIC_DEFAULT, storeId, createdAt: at, updatedAt: at };
  }
  const existingDefault = await Locations.findOne(storeId, { isDefault: true });
  if (existingDefault) return existingDefault;
  const any = await Locations.findOne(storeId, {});
  if (any) {
    return (await Locations.updateOne(storeId, { _id: any._id }, { $set: { isDefault: true } })) ?? any;
  }
  return Locations.create(storeId, { name: "Main location", isDefault: true });
}

/** All locations for a store (ensures a default exists first), oldest first. */
export async function listLocations(storeId: string): Promise<Location[]> {
  if (!isDbConfigured()) {
    const at = new Date().toISOString();
    return [{ ...SYNTHETIC_DEFAULT, storeId, createdAt: at, updatedAt: at }];
  }
  await ensureDefaultLocation(storeId);
  return Locations.findMany(storeId, {}, { sort: { createdAt: 1 } });
}

export async function createLocation(storeId: string, name: string): Promise<Location | null> {
  if (!isDbConfigured()) return null;
  const clean = name.trim();
  if (!clean) return null;
  await ensureDefaultLocation(storeId);
  return Locations.create(storeId, { name: clean, isDefault: false });
}

export async function renameLocation(storeId: string, id: string, name: string): Promise<Location | null> {
  if (!isDbConfigured() || !name.trim()) return null;
  return Locations.updateOne(storeId, { _id: id }, { $set: { name: name.trim() } });
}

/** Make a location the default (clears the flag on the others). */
export async function setDefaultLocation(storeId: string, id: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const target = await Locations.findById(storeId, id);
  if (!target) return false;
  await Locations.updateMany(storeId, { isDefault: true }, { $set: { isDefault: false } });
  await Locations.updateOne(storeId, { _id: id }, { $set: { isDefault: true } });
  return true;
}

/** Delete a non-default location; its stock levels are removed and affected variants resynced. */
export async function deleteLocation(storeId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isDbConfigured()) return { ok: false, error: "Needs a database connection." };
  const loc = await Locations.findById(storeId, id);
  if (!loc) return { ok: false, error: "Location not found." };
  if (loc.isDefault) return { ok: false, error: "Can't delete the default location." };

  const levels = await InventoryLevels.findMany(storeId, { locationId: id });
  await InventoryLevels.deleteMany(storeId, { locationId: id });
  // Resync each affected variant's aggregate from its remaining levels.
  const seen = new Set<string>();
  for (const lvl of levels) {
    const key = `${lvl.productId}:${lvl.variantId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await syncVariantAggregate(storeId, lvl.productId, lvl.variantId);
  }
  await Locations.deleteOne(storeId, { _id: id });
  return { ok: true };
}

/** Per-location stock for one variant (existing rows; missing locations imply 0). */
export async function getVariantLevels(
  storeId: string,
  productId: string,
  variantId: string,
): Promise<InventoryLevel[]> {
  if (!isDbConfigured()) return [];
  return InventoryLevels.findMany(storeId, { productId, variantId });
}

/** Recompute `variant.inventory.quantity` from the sum of its location levels + log it. */
async function syncVariantAggregate(storeId: string, productId: string, variantId: string): Promise<number | null> {
  const levels = await InventoryLevels.findMany(storeId, { productId, variantId });
  const total = levels.reduce((s, l) => s + l.quantity, 0);
  const product = await Products.findById(storeId, productId);
  if (!product) return null;
  const idx = product.variants.findIndex((v) => v.id === variantId);
  if (idx < 0) return null;
  const current = product.variants[idx]!.inventory.quantity;
  if (total === current) return total;
  const variants = product.variants.map((v, j) =>
    j === idx ? { ...v, inventory: { ...v.inventory, quantity: total } } : v,
  );
  await Products.updateOne(storeId, { _id: productId }, { $set: { variants } });
  await InventoryAdjustments.create(storeId, {
    productId,
    variantId,
    delta: total - current,
    reason: "manual",
    resultingQuantity: total,
  });
  return total;
}

/**
 * Set the stock for a (variant, location) and resync the sellable aggregate. The
 * returned number is the new sellable total across all locations.
 */
export async function setInventoryLevel(
  storeId: string,
  input: { productId: string; variantId: string; locationId: string; quantity: number },
): Promise<number | null> {
  if (!isDbConfigured()) return null;
  await InventoryLevels.upsertOne(
    storeId,
    { productId: input.productId, variantId: input.variantId, locationId: input.locationId },
    { $set: { quantity: Math.max(0, Math.floor(input.quantity)) } },
  );
  return syncVariantAggregate(storeId, input.productId, input.variantId);
}

/**
 * Decrement the default location's level when an order ships from it (Phase 6). Keeps
 * the per-location breakdown roughly in step with the aggregate without changing the
 * authoritative sell-side decrement. Best-effort.
 */
export async function decrementDefaultLevel(
  storeId: string,
  productId: string,
  variantId: string,
  quantity: number,
): Promise<void> {
  if (!isDbConfigured()) return;
  const def = await Locations.findOne(storeId, { isDefault: true });
  if (!def) return;
  await InventoryLevels.updateOne(
    storeId,
    { productId, variantId, locationId: def._id },
    { $inc: { quantity: -Math.abs(quantity) } },
  );
}
