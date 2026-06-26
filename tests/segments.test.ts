import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesSegment, resolveSegment, normalizeTag } from "@/lib/data/segments";
import type { Customer } from "@/types";

/** Customer segmentation (Phase 5) — the predicates marketing + the index filter share. */

function customer(over: Partial<Customer>): Customer {
  return {
    _id: "c1",
    storeId: "s1",
    email: "a@example.com",
    name: "A",
    addresses: [],
    tags: [],
    orderCount: 0,
    totalSpent: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...over,
  };
}

test("'all' matches everyone", () => {
  assert.ok(matchesSegment(customer({}), { type: "all" }));
});

test("'tag' matches case-insensitively", () => {
  const c = customer({ tags: ["vip", "wholesale"] });
  assert.ok(matchesSegment(c, { type: "tag", value: "VIP" }));
  assert.ok(!matchesSegment(c, { type: "tag", value: "regular" }));
});

test("'has_ordered' / 'no_orders' split on orderCount", () => {
  assert.ok(matchesSegment(customer({ orderCount: 2 }), { type: "has_ordered" }));
  assert.ok(!matchesSegment(customer({ orderCount: 0 }), { type: "has_ordered" }));
  assert.ok(matchesSegment(customer({ orderCount: 0 }), { type: "no_orders" }));
});

test("'min_spent' is an inclusive threshold; bad value never matches", () => {
  assert.ok(matchesSegment(customer({ totalSpent: 100 }), { type: "min_spent", value: "100" }));
  assert.ok(!matchesSegment(customer({ totalSpent: 99 }), { type: "min_spent", value: "100" }));
  assert.ok(!matchesSegment(customer({ totalSpent: 500 }), { type: "min_spent", value: "abc" }));
});

test("resolveSegment filters + preserves order", () => {
  const list = [
    customer({ _id: "a", orderCount: 1 }),
    customer({ _id: "b", orderCount: 0 }),
    customer({ _id: "c", orderCount: 3 }),
  ];
  assert.deepEqual(
    resolveSegment(list, { type: "has_ordered" }).map((c) => c._id),
    ["a", "c"],
  );
  assert.equal(resolveSegment(list, { type: "all" }).length, 3);
});

test("normalizeTag lowercases, trims, and hyphenates spaces", () => {
  assert.equal(normalizeTag("  VIP Customer "), "vip-customer");
  assert.equal(normalizeTag("Wholesale"), "wholesale");
});
