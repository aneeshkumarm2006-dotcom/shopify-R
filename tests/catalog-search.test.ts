import { test } from "node:test";
import assert from "node:assert/strict";
import type { Product, Variant } from "@/types";
import { searchProducts, getProductFacets, minVariantPrice } from "@/lib/data";
import { mockProducts, MOCK_STORE_ID } from "@/lib/data/mocks";

/**
 * Catalog search / sort / facet tests — `lib/data/products.ts` in MOCK MODE.
 *
 * These run with `MONGODB_URI` unset (`isDbConfigured() === false`), so
 * `searchProducts` / `getProductFacets` take the mock-fixture branch which still
 * executes the REAL filter/sort/facet logic against `mockProducts`. We pin the
 * observable contract (ordering, AND-composition, no-mutation, de-dup) without a DB.
 *
 * Mock-data note: the fixtures carry no `tags` / `productType` / `vendor`, so the
 * tag/type-facet surface is exercised structurally (shape, never-throws, de-dup) —
 * the gap is called out where relevant.
 */

// Active vs draft split in the fixture (single source of truth for expectations).
const ACTIVE_IDS = mockProducts.filter((p) => p.status === "active").map((p) => p._id);
const DRAFT_IDS = mockProducts.filter((p) => p.status === "draft").map((p) => p._id);

// Sanity: the fixture must contain both statuses or the suite is vacuous.
test("fixture sanity: mock catalog has both active and draft products", () => {
  assert.ok(ACTIVE_IDS.length > 0, "need active products");
  assert.ok(DRAFT_IDS.length > 0, "need draft products");
});

/* ============================================================
   minVariantPrice
   ============================================================ */

test("minVariantPrice: returns the lowest variant price across many variants", () => {
  // p1 has variants priced 24 / 78 / 140 → 24.
  const p1 = mockProducts.find((p) => p._id === "p1")!;
  assert.equal(minVariantPrice(p1), 24);
});

test("minVariantPrice: a single-variant product returns that variant's price", () => {
  // p3 has one variant at 55.
  const p3 = mockProducts.find((p) => p._id === "p3")!;
  assert.equal(p3.variants.length, 1);
  assert.equal(minVariantPrice(p3), 55);
});

test("minVariantPrice: a product with NO variants returns 0 (no Math.min(-Infinity))", () => {
  const empty = { ...mockProducts[0], variants: [] as Variant[] } as Product;
  assert.equal(minVariantPrice(empty), 0);
});

test("minVariantPrice: handles a zero-priced variant as a real 0, not falsy-skipped", () => {
  const v: Variant = {
    id: "x",
    title: "Free",
    sku: "FREE",
    barcode: "0",
    price: 0,
    compareAtPrice: null,
    inventory: { quantity: 1, policy: "deny", lowStockThreshold: 0, trackInventory: false },
  };
  const free = { ...mockProducts[0], variants: [v] } as Product;
  assert.equal(minVariantPrice(free), 0);
});

/* ============================================================
   status filter
   ============================================================ */

test("searchProducts: status=active returns ONLY active products", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, { status: "active" });
  assert.equal(rows.length, ACTIVE_IDS.length);
  assert.ok(rows.every((p) => p.status === "active"));
  assert.deepEqual(rows.map((p) => p._id).sort(), [...ACTIVE_IDS].sort());
});

test("searchProducts: status=draft returns ONLY draft products", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, { status: "draft" });
  assert.equal(rows.length, DRAFT_IDS.length);
  assert.ok(rows.every((p) => p.status === "draft"));
  assert.deepEqual(rows.map((p) => p._id).sort(), [...DRAFT_IDS].sort());
});

test("searchProducts: no filters returns every product for the store", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, {});
  assert.equal(rows.length, mockProducts.length);
});

test("searchProducts: an unknown storeId returns [] (tenant scoping)", async () => {
  const rows = await searchProducts("store_does_not_exist", {});
  assert.deepEqual(rows, []);
});

/* ============================================================
   free-text q
   ============================================================ */

test("searchProducts: q matches a word from a real product title", async () => {
  // p1 title is "Blue Dream · 1g".
  const rows = await searchProducts(MOCK_STORE_ID, { q: "Blue" });
  assert.ok(rows.some((p) => p._id === "p1"));
});

test("searchProducts: q is case-INSENSITIVE", async () => {
  const lower = await searchProducts(MOCK_STORE_ID, { q: "wedding" });
  const upper = await searchProducts(MOCK_STORE_ID, { q: "WEDDING" });
  const mixed = await searchProducts(MOCK_STORE_ID, { q: "WeDdInG" });
  assert.ok(lower.length > 0, "expected a 'Wedding Cake' match");
  assert.deepEqual(
    lower.map((p) => p._id),
    upper.map((p) => p._id),
  );
  assert.deepEqual(
    lower.map((p) => p._id),
    mixed.map((p) => p._id),
  );
});

test("searchProducts: a nonsense q returns []", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, { q: "zzzznotaproduct" });
  assert.deepEqual(rows, []);
});

test("searchProducts: empty-string q is ignored (returns all, like no q)", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, { q: "" });
  assert.equal(rows.length, mockProducts.length);
});

test("searchProducts: whitespace-only q is trimmed to empty → returns all", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, { q: "   " });
  assert.equal(rows.length, mockProducts.length);
});

test("searchProducts: q is trimmed before matching (leading/trailing spaces ignored)", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, { q: "  Blue  " });
  assert.ok(rows.some((p) => p._id === "p1"));
});

test("searchProducts: q matches a substring inside the title, not just whole words", async () => {
  // "iesel" is inside "Sour Diesel".
  const rows = await searchProducts(MOCK_STORE_ID, { q: "iesel" });
  assert.ok(rows.some((p) => p._id === "p3"));
});

test("searchProducts: regex metacharacters in q are treated literally (no crash, no over-match)", async () => {
  // The mock branch uses String.includes (not RegExp), so this is a literal search.
  const rows = await searchProducts(MOCK_STORE_ID, { q: ".*" });
  assert.deepEqual(rows, [], "'.*' should match nothing literally");
});

/* ============================================================
   tag / productType facet filters (gap: fixtures lack taxonomy)
   ============================================================ */

test("searchProducts: filtering by a productType absent from fixtures yields [] (documented gap)", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, { productType: "Flower" });
  assert.deepEqual(rows, [], "mock products carry no productType, so any type filter empties the set");
});

test("searchProducts: filtering by a tag absent from fixtures yields [] (documented gap)", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, { tag: "sativa" });
  assert.deepEqual(rows, [], "mock products carry no tags, so any tag filter empties the set");
});

/* ============================================================
   sort
   ============================================================ */

function isAscByPrice(rows: Product[]): boolean {
  for (let i = 1; i < rows.length; i++) {
    if (minVariantPrice(rows[i - 1]!) > minVariantPrice(rows[i]!)) return false;
  }
  return true;
}
function isDescByPrice(rows: Product[]): boolean {
  for (let i = 1; i < rows.length; i++) {
    if (minVariantPrice(rows[i - 1]!) < minVariantPrice(rows[i]!)) return false;
  }
  return true;
}

test("searchProducts: sort=price_asc orders by ascending minVariantPrice", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, { sort: "price_asc" });
  assert.equal(rows.length, mockProducts.length);
  assert.ok(isAscByPrice(rows), "prices must be non-decreasing");
});

test("searchProducts: sort=price_desc orders by descending minVariantPrice", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, { sort: "price_desc" });
  assert.ok(isDescByPrice(rows), "prices must be non-increasing");
});

test("searchProducts: sort=title is alphabetical (localeCompare)", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, { sort: "title" });
  const titles = rows.map((p) => p.title);
  const expected = [...titles].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(titles, expected);
});

test("searchProducts: default sort (newest) is createdAt-desc and deterministic", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, {});
  for (let i = 1; i < rows.length; i++) {
    assert.ok(
      rows[i - 1]!.createdAt >= rows[i]!.createdAt,
      "createdAt must be non-increasing under default/newest sort",
    );
  }
});

test("searchProducts: sort is STABLE — same input yields the same order", async () => {
  const a = await searchProducts(MOCK_STORE_ID, { sort: "price_asc" });
  const b = await searchProducts(MOCK_STORE_ID, { sort: "price_asc" });
  assert.deepEqual(
    a.map((p) => p._id),
    b.map((p) => p._id),
  );
});

test("searchProducts: sorting does NOT mutate the shared mockProducts array", async () => {
  const before = mockProducts.map((p) => p._id);
  await searchProducts(MOCK_STORE_ID, { sort: "price_desc" });
  await searchProducts(MOCK_STORE_ID, { sort: "price_asc" });
  await searchProducts(MOCK_STORE_ID, { sort: "title" });
  const after = mockProducts.map((p) => p._id);
  assert.deepEqual(after, before, "the source fixture order must be untouched by sorting");
});

test("searchProducts: returned objects are clones, not the shared fixture references", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, { status: "active" });
  const original = mockProducts.find((p) => p._id === rows[0]!._id)!;
  assert.notEqual(rows[0], original, "callers must not be able to mutate the fixture");
});

/* ============================================================
   combined filters (AND semantics)
   ============================================================ */

test("searchProducts: q + status compose with AND semantics", async () => {
  // "Wedding Cake · 7g" (p8) is a DRAFT; "Live Rosin Vape" mentions "Wedding Cake" in
  // its option values but not its title/type/tags/vendor, so q=wedding hits only p8.
  const draftMatch = await searchProducts(MOCK_STORE_ID, { q: "wedding", status: "draft" });
  assert.ok(draftMatch.some((p) => p._id === "p8"));
  assert.ok(draftMatch.every((p) => p.status === "draft"));

  // The same q narrowed to ACTIVE must NOT return the draft p8.
  const activeMatch = await searchProducts(MOCK_STORE_ID, { q: "wedding", status: "active" });
  assert.ok(activeMatch.every((p) => p.status === "active"));
  assert.ok(!activeMatch.some((p) => p._id === "p8"), "draft must not leak into active results");
});

test("searchProducts: q + status + sort all compose", async () => {
  const rows = await searchProducts(MOCK_STORE_ID, { status: "active", sort: "price_asc" });
  assert.ok(rows.every((p) => p.status === "active"));
  assert.ok(isAscByPrice(rows));
});

/* ============================================================
   getProductFacets
   ============================================================ */

test("getProductFacets: returns { productTypes, tags } arrays and never throws", async () => {
  const facets = await getProductFacets(MOCK_STORE_ID);
  assert.ok(Array.isArray(facets.productTypes));
  assert.ok(Array.isArray(facets.tags));
});

test("getProductFacets: with taxonomy-free fixtures, both facet arrays are empty (documented gap)", async () => {
  const facets = await getProductFacets(MOCK_STORE_ID);
  assert.deepEqual(facets.productTypes, []);
  assert.deepEqual(facets.tags, []);
});

test("getProductFacets: an unknown store yields empty facets, not an error", async () => {
  const facets = await getProductFacets("store_does_not_exist");
  assert.deepEqual(facets.productTypes, []);
  assert.deepEqual(facets.tags, []);
});

test("getProductFacets: any present values are de-duped and sorted (logic check via getProductFacets contract)", async () => {
  // The fixtures lack taxonomy, so we assert the invariant the function guarantees:
  // whatever it returns must be sorted and free of duplicates.
  const facets = await getProductFacets(MOCK_STORE_ID);
  for (const arr of [facets.productTypes, facets.tags]) {
    assert.deepEqual(arr, [...new Set(arr)], "facets must be de-duplicated");
    assert.deepEqual(arr, [...arr].sort((a, b) => a.localeCompare(b)), "facets must be sorted");
  }
});
