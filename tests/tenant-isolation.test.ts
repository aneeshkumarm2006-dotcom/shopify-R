import { test } from "node:test";
import assert from "node:assert/strict";
import { scopedFilter, requireStoreId, TenantScopeError } from "../lib/db/scope";

/**
 * Tenant-isolation chokepoint tests (Stage 14, PRD §9).
 *
 * `scopedFilter` is the single funnel every store-scoped query passes through
 * (`StoreScopedRepository` builds every filter with it, and the few direct-model
 * reads — `theme.ts` — call it too). If it provably forces the scope and refuses to
 * be overridden, cross-store reads/writes are impossible by construction, without
 * needing a live database to prove it. These tests pin that contract.
 */

test("requireStoreId throws on a missing / empty / blank storeId", () => {
  assert.throws(() => requireStoreId(""), TenantScopeError);
  assert.throws(() => requireStoreId("   "), TenantScopeError);
  // @ts-expect-error — exercising the runtime guard against non-string callers
  assert.throws(() => requireStoreId(undefined), TenantScopeError);
  // @ts-expect-error
  assert.throws(() => requireStoreId(null), TenantScopeError);
});

test("requireStoreId returns the id for a valid value", () => {
  assert.equal(requireStoreId("store_a"), "store_a");
});

test("scopedFilter always injects the validated storeId", () => {
  assert.deepEqual(scopedFilter("store_a"), { storeId: "store_a" });
  assert.deepEqual(scopedFilter("store_a", { handle: "hat" }), {
    handle: "hat",
    storeId: "store_a",
  });
});

test("scopedFilter refuses a query with no storeId (fails loud, not silently cross-tenant)", () => {
  assert.throws(() => scopedFilter("", { handle: "hat" }), TenantScopeError);
});

test("CROSS-STORE DENIAL: a caller cannot override the scope with their own storeId", () => {
  // Store A is the scope; the caller tries to smuggle store B's id into the filter.
  const filter = scopedFilter("store_a", { storeId: "store_b", handle: "hat" });
  // The forced scope wins — the query can only ever read store A's data.
  assert.equal(filter.storeId, "store_a");
  assert.equal(filter.handle, "hat");
});

test("CROSS-STORE DENIAL: even an array/object storeId payload is dropped, not merged", () => {
  const filter = scopedFilter("store_a", {
    storeId: { $ne: "store_a" }, // attempt to invert the scope
  });
  assert.deepEqual(filter, { storeId: "store_a" });
});
