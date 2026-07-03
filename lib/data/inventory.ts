import type { InventoryAdjustment, InventoryPolicy, InventoryReason, Product, Variant } from "@/types";
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
  /** `deny` variants are guarded so a concurrent order can't push them below zero. */
  policy: InventoryPolicy;
}

/** A successfully reserved (decremented) line + the authoritative post-decrement qty. */
export interface AppliedDecrement {
  productId: string;
  variantId: string;
  quantity: number;
  resultingQuantity: number;
}

/**
 * Atomically RESERVE stock for an order (PRD §6.5), BEFORE the order is committed. Each
 * line is a single guarded `$inc` on the embedded variant, so concurrent checkouts can
 * neither lose a write (the old read-modify-`$set` did — last-writer-wins) nor oversell
 * a `deny` variant: the `$gte` guard makes the decrement match only while enough stock
 * remains. `continue`-policy variants decrement unconditionally (overselling is allowed
 * by design). On the first `deny` shortfall it stops and returns `ok:false` with what
 * was already applied, so the caller can `releaseInventory` those and reject the order.
 * Untracked variants must be filtered out by the caller (checkout already does).
 */
export async function reserveInventory(
  storeId: string,
  lines: DecrementLine[],
): Promise<
  | { ok: true; applied: AppliedDecrement[] }
  | { ok: false; applied: AppliedDecrement[]; failed: DecrementLine }
> {
  if (!isDbConfigured()) {
    // Mock mode: no persistence; the in-memory pre-check already gated oversell.
    return { ok: true, applied: lines.map((l) => ({ ...l, resultingQuantity: 0 })) };
  }
  const applied: AppliedDecrement[] = [];
  for (const line of lines) {
    const qty = Math.abs(line.quantity);
    const elem =
      line.policy === "deny"
        ? { id: line.variantId, "inventory.quantity": { $gte: qty } }
        : { id: line.variantId };
    const updated = (await Products.updateOne(
      storeId,
      { _id: line.productId, variants: { $elemMatch: elem } },
      { $inc: { "variants.$.inventory.quantity": -qty } },
    )) as Product | null;
    if (!updated) {
      // deny shortfall (or the variant vanished mid-checkout) → stop; caller compensates.
      return { ok: false, applied, failed: line };
    }
    const v = updated.variants.find((x) => x.id === line.variantId);
    applied.push({
      productId: line.productId,
      variantId: line.variantId,
      quantity: qty,
      resultingQuantity: v?.inventory.quantity ?? 0,
    });
  }
  return { ok: true, applied };
}

/** Compensating re-increment when a reserved order fails to persist (or a deny line fails). */
export async function releaseInventory(storeId: string, applied: AppliedDecrement[]): Promise<void> {
  if (!isDbConfigured()) return;
  for (const a of applied) {
    await Products.updateOne(
      storeId,
      { _id: a.productId, variants: { $elemMatch: { id: a.variantId } } },
      { $inc: { "variants.$.inventory.quantity": a.quantity } },
    ).catch(() => {});
  }
}

/**
 * Write the `reason: "order"` audit rows + per-location breakdown AFTER the order is
 * committed (the quantity was already moved by `reserveInventory`). Idempotent by
 * `orderId`: a retry that re-drives fulfillment won't double-log or double-decrement,
 * since the guarded reservation ran once and this skips lines already recorded.
 */
export async function logOrderDecrements(
  storeId: string,
  applied: AppliedDecrement[],
  orderId: string,
): Promise<void> {
  if (!isDbConfigured()) return;
  for (const a of applied) {
    const exists = await InventoryAdjustments.findOne(storeId, {
      orderId,
      productId: a.productId,
      variantId: a.variantId,
      reason: "order",
    });
    if (exists) continue;
    await InventoryAdjustments.create(storeId, {
      productId: a.productId,
      variantId: a.variantId,
      delta: -a.quantity,
      reason: "order",
      resultingQuantity: a.resultingQuantity,
      orderId,
    });
    try {
      await decrementDefaultLevel(storeId, a.productId, a.variantId, a.quantity);
    } catch {
      /* best-effort: the authoritative aggregate is already decremented */
    }
  }
}
