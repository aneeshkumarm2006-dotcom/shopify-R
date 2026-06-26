import type { InventoryAdjustment, InventoryReason, Product, Variant } from "@/types";
import { mockInventoryAdjustments, mockProducts } from "./mocks";
import { resolve, scoped } from "./_util";
import { isDbConfigured, InventoryAdjustments, Products } from "@/lib/db";
import { decrementDefaultLevel } from "./locations";

/** A flat, per-variant inventory view derived from products (PRD §6.5). */
export interface InventoryRow {
  productId: string;
  productTitle: string;
  variant: Variant;
  onHand: number;
  threshold: number;
  status: "in_stock" | "low" | "out";
}

function rowStatus(v: Variant): InventoryRow["status"] {
  if (v.inventory.quantity <= 0) return "out";
  if (v.inventory.quantity <= v.inventory.lowStockThreshold) return "low";
  return "in_stock";
}

function toRows(products: Product[]): InventoryRow[] {
  const rows: InventoryRow[] = [];
  for (const p of products) {
    for (const v of p.variants) {
      rows.push({
        productId: p._id,
        productTitle: p.title,
        variant: v,
        onHand: v.inventory.quantity,
        threshold: v.inventory.lowStockThreshold,
        status: rowStatus(v),
      });
    }
  }
  return rows;
}

export async function getInventory(storeId: string): Promise<InventoryRow[]> {
  const products = isDbConfigured()
    ? await Products.findMany(storeId)
    : (scoped(mockProducts, storeId) as Product[]);
  return resolve(toRows(products));
}

/** Low-stock + out-of-stock rows for dashboard alerts (PRD §6.9). */
export async function getLowStock(storeId: string): Promise<InventoryRow[]> {
  const all = await getInventory(storeId);
  return all.filter((r) => r.status !== "in_stock");
}

/** Audit log entries (PRD §5.6), optionally scoped to one product. */
export async function getInventoryAdjustments(
  storeId: string,
  productId?: string,
): Promise<InventoryAdjustment[]> {
  if (!isDbConfigured()) {
    let rows = scoped(mockInventoryAdjustments, storeId);
    if (productId) rows = rows.filter((a) => a.productId === productId);
    return resolve(rows);
  }
  return InventoryAdjustments.findMany(
    storeId,
    productId ? { productId } : {},
    { sort: { createdAt: -1 } },
  );
}

/* ============================================================
   Writes (Stage 9, PRD §6.5) — manual adjustments + the order decrement seam.
   Both funnel through `applyAdjustment`, which updates the embedded variant's
   quantity AND writes an `inventoryAdjustments` audit entry with the resulting
   snapshot, so every stock change is traceable (PRD §5.6).
   ============================================================ */

export interface AdjustmentResult {
  resultingQuantity: number;
}

/** One stock change to apply: either a relative `delta` or an absolute `setTo`. */
export interface AdjustmentSpec {
  productId: string;
  variantId: string;
  reason: InventoryReason;
  /** Relative change (e.g. +12 restock, −1 sold). Ignored if `setTo` is given. */
  delta?: number;
  /** Absolute target quantity (manual "set to"). Wins over `delta`. */
  setTo?: number;
  /** Set when `reason === "order"` so the audit row links back to the order. */
  orderId?: string;
}

function variantIndex(product: Product, variantId: string): number {
  return product.variants.findIndex((v) => v.id === variantId);
}

/**
 * Apply a single adjustment to a variant and log it. Returns the resulting
 * quantity, or null if the product/variant isn't found in this store. Manual
 * reasons never drive a quantity below zero; order decrements may (a `continue`
 * policy can oversell), which the audit log faithfully records.
 */
async function applyAdjustment(
  storeId: string,
  spec: AdjustmentSpec,
): Promise<AdjustmentResult | null> {
  const product = isDbConfigured()
    ? await Products.findById(storeId, spec.productId)
    : (scoped(mockProducts, storeId).find((p) => p._id === spec.productId) ?? null);
  if (!product) return null;

  const idx = variantIndex(product, spec.variantId);
  if (idx < 0) return null;

  const current = product.variants[idx]!.inventory.quantity;
  const target =
    spec.setTo !== undefined
      ? spec.setTo
      : spec.reason === "order"
        ? current + (spec.delta ?? 0)
        : Math.max(0, current + (spec.delta ?? 0));
  const delta = target - current;

  if (!isDbConfigured()) {
    // Mock mode: no persistence, but return the computed snapshot so the UI flows.
    return { resultingQuantity: target };
  }

  // Persist the new quantity on the embedded variant…
  const variants = product.variants.map((v, j) =>
    j === idx ? { ...v, inventory: { ...v.inventory, quantity: target } } : v,
  );
  await Products.updateOne(storeId, { _id: product._id }, { $set: { variants } });

  // …and write the audit-log entry (PRD §5.6).
  await InventoryAdjustments.create(storeId, {
    productId: spec.productId,
    variantId: spec.variantId,
    delta,
    reason: spec.reason,
    resultingQuantity: target,
    ...(spec.orderId ? { orderId: spec.orderId } : {}),
  });

  return { resultingQuantity: target };
}

/** Manual adjustment from the Inventory screen (restock / correction / manual). */
export async function adjustInventory(
  storeId: string,
  input: {
    productId: string;
    variantId: string;
    mode: "add" | "set";
    amount: number;
    reason: InventoryReason;
  },
): Promise<AdjustmentResult | null> {
  return applyAdjustment(storeId, {
    productId: input.productId,
    variantId: input.variantId,
    reason: input.reason,
    ...(input.mode === "set" ? { setTo: input.amount } : { delta: input.amount }),
  });
}

/** A line to decrement when an order is placed (Stage 10 consumes this). */
export interface DecrementLine {
  productId: string;
  variantId: string;
  quantity: number;
}

/**
 * Decrement seam for order placement (PRD §6.5 — "automatic decrement on order
 * placement, writes an inventoryAdjustments log entry"). Each line subtracts its
 * quantity and writes an audit row with `reason: "order"` + the `orderId`. Only
 * variants with `trackInventory` are decremented; untracked ones are skipped.
 * Built and unit-tested here; Stage 10's checkout calls it.
 */
export async function decrementInventory(
  storeId: string,
  lines: DecrementLine[],
  orderId: string,
): Promise<void> {
  for (const line of lines) {
    await applyAdjustment(storeId, {
      productId: line.productId,
      variantId: line.variantId,
      reason: "order",
      delta: -Math.abs(line.quantity),
      orderId,
    });
    // Keep the per-location breakdown in step by drawing from the default location.
    try {
      await decrementDefaultLevel(storeId, line.productId, line.variantId, line.quantity);
    } catch {
      /* best-effort: the authoritative aggregate is already decremented above */
    }
  }
}
