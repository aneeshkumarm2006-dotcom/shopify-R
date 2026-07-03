import { test } from "node:test";
import assert from "node:assert/strict";
import {
  productMatchesRule,
  productMatchesRules,
  filterProductsByRules,
} from "@/lib/data/collection-rules";
import type { Product } from "@/types";

/** Smart-collection rule engine (Phase 4). Membership = active products that match. */

function product(over: Partial<Product>): Product {
  return {
    _id: "p1",
    storeId: "s1",
    title: "Blue Dream",
    description: "",
    images: [],
    status: "active",
    handle: "blue-dream",
    productType: "Flower",
    vendor: "Northbound",
    tags: ["sativa", "premium"],
    attributes: [],
    seo: {},
    options: [],
    variants: [{ id: "v1", title: "1g", sku: "", price: 40, inventory: { quantity: 1, policy: "deny", lowStockThreshold: 0, trackInventory: true } }],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...over,
  };
}

test("text ops: equals / contains / starts_with are case-insensitive", () => {
  const p = product({});
  assert.ok(productMatchesRule(p, { field: "productType", op: "equals", value: "flower" }));
  assert.ok(productMatchesRule(p, { field: "tag", op: "contains", value: "PREM" }));
  assert.ok(productMatchesRule(p, { field: "title", op: "starts_with", value: "blue" }));
  assert.ok(!productMatchesRule(p, { field: "vendor", op: "equals", value: "Other" }));
});

test("price ops compare against the lowest variant price", () => {
  const p = product({});
  assert.ok(productMatchesRule(p, { field: "price", op: "gt", value: "30" }));
  assert.ok(productMatchesRule(p, { field: "price", op: "lt", value: "50" }));
  assert.ok(!productMatchesRule(p, { field: "price", op: "gt", value: "100" }));
});

test("an empty rule value never matches (guards against 'matches everything')", () => {
  assert.ok(!productMatchesRule(product({}), { field: "tag", op: "equals", value: "  " }));
});

test("match=all is AND, match=any is OR", () => {
  const p = product({});
  const all = {
    match: "all" as const,
    conditions: [
      { field: "productType" as const, op: "equals" as const, value: "Flower" },
      { field: "tag" as const, op: "equals" as const, value: "sativa" },
    ],
  };
  assert.ok(productMatchesRules(p, all));

  const allFail = {
    match: "all" as const,
    conditions: [
      { field: "productType" as const, op: "equals" as const, value: "Flower" },
      { field: "tag" as const, op: "equals" as const, value: "indica" },
    ],
  };
  assert.ok(!productMatchesRules(p, allFail));
  assert.ok(productMatchesRules(p, { ...allFail, match: "any" }));
});

test("a rule set with no usable conditions yields no members", () => {
  const empty = { match: "all" as const, conditions: [] };
  assert.ok(!productMatchesRules(product({}), empty));
  assert.deepEqual(filterProductsByRules([product({})], empty), []);
  assert.deepEqual(filterProductsByRules([product({})], null), []);
});

test("filter preserves input order", () => {
  const a = product({ _id: "a", tags: ["sativa"] });
  const b = product({ _id: "b", tags: ["indica"] });
  const c = product({ _id: "c", tags: ["sativa"] });
  const out = filterProductsByRules([a, b, c], {
    match: "all",
    conditions: [{ field: "tag", op: "equals", value: "sativa" }],
  });
  assert.deepEqual(out.map((p) => p._id), ["a", "c"]);
});

test("not_equals matches a product that HAS the value only when it differs", () => {
  const withSale = product({ tags: ["sale", "premium"] });
  const withoutSale = product({ tags: ["premium"] });
  assert.ok(!productMatchesRule(withSale, { field: "tag", op: "not_equals", value: "sale" }));
  assert.ok(productMatchesRule(withoutSale, { field: "tag", op: "not_equals", value: "sale" }));
});

test("not_equals matches a product with NO value for the field (regression)", () => {
  // A product with no tags "is not equal to sale" — it must belong to a
  // "tag is not sale" collection, matching Shopify (the old length>0 guard dropped it).
  const noTags = product({ tags: [] });
  assert.ok(productMatchesRule(noTags, { field: "tag", op: "not_equals", value: "sale" }));
  const noVendor = product({ vendor: "" });
  assert.ok(productMatchesRule(noVendor, { field: "vendor", op: "not_equals", value: "acme" }));
});
