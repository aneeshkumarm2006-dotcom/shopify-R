import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeCartItems, customerCartKey } from "@/lib/data/cart";
import type { CartItem } from "@/types";

/**
 * Cart merge on login (Phase 3). The anonymous cart unions with the customer's saved
 * cart by (productId, variantId), summing quantities — the guarantee behind "your cart
 * follows you when you sign in" without losing or double-listing items.
 */

const item = (productId: string, variantId: string, quantity: number): CartItem => ({
  productId,
  variantId,
  quantity,
  priceSnapshot: 10,
});

test("same product+variant sums quantities", () => {
  const merged = mergeCartItems([item("p1", "v1", 2)], [item("p1", "v1", 3)]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.quantity, 5);
});

test("distinct items are unioned, anonymous-first order preserved", () => {
  const merged = mergeCartItems(
    [item("p1", "v1", 1), item("p2", "v1", 1)],
    [item("p2", "v1", 4), item("p3", "v1", 2)],
  );
  assert.deepEqual(
    merged.map((i) => [i.productId, i.quantity]),
    [["p1", 1], ["p2", 5], ["p3", 2]],
  );
});

test("variants of the same product stay separate", () => {
  const merged = mergeCartItems([item("p1", "v1", 1)], [item("p1", "v2", 1)]);
  assert.equal(merged.length, 2);
});

test("empty inputs are handled either way", () => {
  assert.deepEqual(mergeCartItems([], [item("p1", "v1", 2)]).map((i) => i.quantity), [2]);
  assert.deepEqual(mergeCartItems([item("p1", "v1", 2)], []).map((i) => i.quantity), [2]);
  assert.deepEqual(mergeCartItems([], []), []);
});

test("inputs are not mutated", () => {
  const a = [item("p1", "v1", 2)];
  const b = [item("p1", "v1", 3)];
  mergeCartItems(a, b);
  assert.equal(a[0]!.quantity, 2);
  assert.equal(b[0]!.quantity, 3);
});

test("customerCartKey derives a stable, namespaced key", () => {
  assert.equal(customerCartKey("cust_1"), "cust:cust_1");
});
