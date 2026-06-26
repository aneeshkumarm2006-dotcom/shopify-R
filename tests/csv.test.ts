import { test } from "node:test";
import assert from "node:assert/strict";
import { productsToCsv, parseProductCsv, parseCsvGrid } from "@/lib/data/csv";
import type { Product } from "@/types";

/** Product CSV import/export (Phase 4) — round-trip + quote-aware parsing. */

function product(over: Partial<Product>): Product {
  return {
    _id: "p1",
    storeId: "s1",
    title: "Blue Dream",
    description: "<p>Smooth & <b>balanced</b></p>",
    images: [],
    status: "active",
    handle: "blue-dream",
    productType: "Flower",
    vendor: "Northbound",
    tags: ["sativa", "premium"],
    attributes: [],
    seo: {},
    options: [],
    variants: [{ id: "v1", title: "1g", sku: "BD-1G", barcode: "111", price: 40, compareAtPrice: 50, inventory: { quantity: 7, policy: "deny", lowStockThreshold: 0, trackInventory: true } }],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...over,
  };
}

test("parseCsvGrid handles quoted commas, escaped quotes, and newlines in cells", () => {
  const grid = parseCsvGrid('a,b\n"x,y","he said ""hi"""\n"multi\nline",z');
  assert.deepEqual(grid, [
    ["a", "b"],
    ["x,y", 'he said "hi"'],
    ["multi\nline", "z"],
  ]);
});

test("export → import round-trips the core fields", () => {
  const csv = productsToCsv([product({})]);
  const { rows, errors } = parseProductCsv(csv);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 1);
  const r = rows[0]!;
  assert.equal(r.handle, "blue-dream");
  assert.equal(r.title, "Blue Dream");
  assert.equal(r.price, 40);
  assert.equal(r.compareAtPrice, 50);
  assert.equal(r.sku, "BD-1G");
  assert.equal(r.quantity, 7);
  assert.deepEqual(r.tags, ["sativa", "premium"]);
  assert.equal(r.status, "active");
  assert.ok(!r.description.includes("<")); // HTML stripped on export
});

test("column order is flexible; missing required columns error", () => {
  const ok = parseProductCsv("title,price,handle\nWidget,9.99,widget");
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.rows[0]!.handle, "widget");
  assert.equal(ok.rows[0]!.price, 9.99);

  const bad = parseProductCsv("title,price\nWidget,9.99");
  assert.equal(bad.rows.length, 0);
  assert.ok(bad.errors[0]!.includes("handle"));
});

test("rows missing handle/title are skipped with a line-numbered error", () => {
  const { rows, errors } = parseProductCsv("handle,title,price\nok,Good,5\n,NoHandle,5");
  assert.equal(rows.length, 1);
  assert.ok(errors[0]!.includes("Line 3"));
});

test("status defaults to draft when blank or unknown", () => {
  const { rows } = parseProductCsv("handle,title,price,status\na,A,1,\nb,B,1,bogus");
  assert.equal(rows[0]!.status, "draft");
  assert.equal(rows[1]!.status, "draft");
});
