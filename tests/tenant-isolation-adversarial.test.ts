import { test } from "node:test";
import assert from "node:assert/strict";
import { scopedFilter, requireStoreId, TenantScopeError } from "@/lib/db/scope";

/**
 * Adversarial tenant-isolation cases for `scopedFilter` / `requireStoreId`
 * (companion to `tests/tenant-isolation.test.ts`, PRD §9).
 *
 * `scopedFilter` is the single chokepoint every store-scoped query is built through, so
 * the question these tests probe is: can a caller smuggle a foreign `storeId` past the
 * forced scope using a Mongo operator shape ($in, $ne), an array, or NESTED $or/$and?
 * Where the answer is "no", we pin it. Where the guard does NOT reach (it only strips a
 * TOP-LEVEL `storeId`), we document the residual surface in a comment + the report so the
 * reliance on Mongo's implicit top-level AND is explicit, not accidental.
 */

// ── whitespace / blank storeId ─────────────────────────────────────────────────

test("requireStoreId throws on whitespace-only storeId (tab / newline / spaces)", () => {
  assert.throws(() => requireStoreId("   "), TenantScopeError);
  assert.throws(() => requireStoreId("\t"), TenantScopeError);
  assert.throws(() => requireStoreId("\n"), TenantScopeError);
  assert.throws(() => requireStoreId(" \t\n "), TenantScopeError);
});

test("scopedFilter throws on a whitespace-only storeId rather than scoping to blank", () => {
  assert.throws(() => scopedFilter("   ", { handle: "hat" }), TenantScopeError);
  assert.throws(() => scopedFilter("\t\n"), TenantScopeError);
});

// ── operator-shaped storeId overrides are dropped, scope forced ───────────────

test("CROSS-STORE DENIAL: a `{ $in: [...] }` storeId is overridden by the forced scope", () => {
  const filter = scopedFilter("store_a", { storeId: { $in: ["store_b", "store_c"] } });
  // The caller's $in is discarded entirely; only store_a survives.
  assert.deepEqual(filter, { storeId: "store_a" });
});

test("CROSS-STORE DENIAL: a `{ $ne }` / `{ $gt }` storeId override is dropped", () => {
  assert.deepEqual(scopedFilter("store_a", { storeId: { $ne: "store_a" } }), {
    storeId: "store_a",
  });
  assert.deepEqual(scopedFilter("store_a", { storeId: { $gt: "" } }), {
    storeId: "store_a",
  });
});

test("CROSS-STORE DENIAL: an ARRAY storeId payload is dropped, not merged", () => {
  const filter = scopedFilter("store_a", {
    storeId: ["store_b", "store_c"],
  } as Record<string, unknown>);
  assert.deepEqual(filter, { storeId: "store_a" });
});

// ── NESTED $or / $and carrying a foreign storeId ───────────────────────────────

test("ISOLATION PROBE: a foreign storeId nested inside $or is NOT stripped (only top-level is)", () => {
  // scopedFilter strips ONLY the top-level `storeId` key. A `$or` array that itself
  // contains `{ storeId: "store_b" }` passes through verbatim, and the forced top-level
  // `storeId: "store_a"` is appended alongside it.
  const filter = scopedFilter("store_a", {
    $or: [{ storeId: "store_b" }, { storeId: "store_c" }],
  });
  assert.equal(filter.storeId, "store_a", "top-level scope is forced to store_a");
  // The nested foreign ids survive in the $or branch (documented residual surface):
  assert.deepEqual(filter.$or, [{ storeId: "store_b" }, { storeId: "store_c" }]);

  // WHY THIS IS STILL SAFE *in Mongo*: the resulting query is
  //   { $or: [...], storeId: "store_a" }
  // which Mongo AND-combines — every matched doc must ALSO have storeId === "store_a",
  // so the foreign branches can never widen the tenant scope. The isolation guarantee
  // therefore depends on Mongo's implicit top-level AND, NOT on scopedFilter rewriting
  // nested clauses. Reported as a residual surface (not a fix): if a caller ever spreads
  // a nested clause to the TOP level, or a future query builder lifts $or branches, the
  // forced scope would no longer dominate. Flagged in the report.
});

test("ISOLATION PROBE: a foreign storeId nested inside $and is likewise left intact", () => {
  const filter = scopedFilter("store_a", {
    $and: [{ storeId: "store_b" }],
  });
  assert.equal(filter.storeId, "store_a");
  // $and: [{storeId:"store_b"}] AND storeId:"store_a" → matches nothing (contradiction),
  // which is fail-CLOSED — it cannot leak store_b's data. Pin the passthrough shape.
  assert.deepEqual(filter.$and, [{ storeId: "store_b" }]);
});

// ── fresh-object / no-mutation contract ────────────────────────────────────────

test("scopedFilter returns a FRESH object and never mutates the caller's filter", () => {
  const caller = { handle: "hat", storeId: "store_b", $or: [{ a: 1 }] };
  const before = structuredClone(caller);
  const filter = scopedFilter("store_a", caller);

  assert.notEqual(filter, caller, "must not return the same reference");
  assert.deepEqual(caller, before, "caller's filter object must be untouched");
  // caller still carries its (ignored) store_b — proving scopedFilter copied, not mutated.
  assert.equal(caller.storeId, "store_b");
  assert.equal(filter.storeId, "store_a");
});

test("scopedFilter with the default empty extra yields a clean single-key filter", () => {
  assert.deepEqual(scopedFilter("store_a"), { storeId: "store_a" });
});

test("scopedFilter preserves unrelated operator keys while forcing scope", () => {
  const filter = scopedFilter("store_a", {
    status: { $in: ["live", "draft"] },
    createdAt: { $gte: "2026-01-01" },
    storeId: "store_b",
  });
  assert.deepEqual(filter, {
    status: { $in: ["live", "draft"] },
    createdAt: { $gte: "2026-01-01" },
    storeId: "store_a",
  });
});
