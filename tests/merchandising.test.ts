import { test } from "node:test";
import assert from "node:assert/strict";
import { relatedScore, relatedProducts, applyBulkEdit } from "@/lib/data/products";
import { summarizeRatings, normalizeRating } from "@/lib/data/reviews";
import type { Product } from "@/types";

/** Related products, bulk edit, and review aggregation (Phase 4). */

function product(over: Partial<Product>): Product {
  return {
    _id: "p1",
    storeId: "s1",
    title: "Base",
    description: "",
    images: [],
    status: "active",
    handle: "base",
    productType: "Flower",
    vendor: "Northbound",
    tags: ["sativa"],
    attributes: [],
    seo: {},
    options: [],
    variants: [{ id: "v1", title: "1g", sku: "", price: 40, inventory: { quantity: 1, policy: "deny", lowStockThreshold: 0, trackInventory: true } }],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...over,
  };
}

test("relatedScore weights type > shared tags > vendor; self scores 0", () => {
  const base = product({ _id: "base", tags: ["sativa", "premium"] });
  assert.equal(relatedScore(base, base), 0);
  // same type (3) + 1 shared tag (1) + same vendor (1) = 5
  assert.equal(relatedScore(base, product({ _id: "x", tags: ["sativa"] })), 5);
  // different type, no shared tags, same vendor = 1
  assert.equal(relatedScore(base, product({ _id: "y", productType: "Edibles", tags: [] })), 1);
});

test("relatedProducts returns highest-scoring active products, excludes self + drafts", () => {
  const base = product({ _id: "base" });
  const strong = product({ _id: "strong", tags: ["sativa"] }); // score 5
  const weak = product({ _id: "weak", productType: "Edibles", tags: [] }); // score 1
  const draft = product({ _id: "draft", status: "draft" });
  const out = relatedProducts(base, [base, weak, strong, draft], 4);
  assert.deepEqual(out.map((p) => p._id), ["strong", "weak"]);
});

test("applyBulkEdit adds/removes tags without duplicating (case-insensitive)", () => {
  const p = product({ tags: ["sativa", "premium"] });
  const patch = applyBulkEdit(p, { addTags: ["NEW", "Sativa"], removeTags: ["premium"] });
  assert.deepEqual(patch.tags, ["sativa", "NEW"]);
});

test("applyBulkEdit adjusts every variant price by percent, rounded, never negative", () => {
  const p = product({ variants: [
    { id: "a", title: "", sku: "", price: 40, inventory: { quantity: 0, policy: "deny", lowStockThreshold: 0, trackInventory: true } },
    { id: "b", title: "", sku: "", price: 10, inventory: { quantity: 0, policy: "deny", lowStockThreshold: 0, trackInventory: true } },
  ] });
  const patch = applyBulkEdit(p, { priceAdjustPct: 10 });
  assert.deepEqual(patch.variants!.map((v) => v.price), [44, 11]);
});

test("applyBulkEdit returns only the fields that changed", () => {
  assert.deepEqual(applyBulkEdit(product({}), {}), {});
  assert.deepEqual(applyBulkEdit(product({}), { status: "draft" }), { status: "draft" });
});

test("summarizeRatings averages to one decimal; empty is zero", () => {
  assert.deepEqual(summarizeRatings([]), { average: 0, count: 0 });
  assert.deepEqual(summarizeRatings([{ rating: 5 }, { rating: 4 }, { rating: 4 }]), {
    average: 4.3,
    count: 3,
  });
});

test("normalizeRating clamps to an integer 1–5", () => {
  assert.equal(normalizeRating(0), 1);
  assert.equal(normalizeRating(9), 5);
  assert.equal(normalizeRating(3.6), 4);
});
