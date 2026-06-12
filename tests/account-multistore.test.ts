import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getUserById,
  getStoresForOwner,
  getOwnedStoreCount,
  getAccountPlan,
  getStoreCapStatus,
  setActiveStore,
} from "@/lib/data";
import { storeCapForPlan } from "@/lib/payments/billing";
import {
  MOCK_STORE_ID,
  MOCK_OWNER_ID,
  mockUser,
} from "@/lib/data/mocks";

/**
 * Multi-store account / plan-cap / ownership tests — MOCK MODE (`MONGODB_URI` unset →
 * `isDbConfigured() === false`).
 *
 * These pin the account → stores mapping (`lib/data/account.ts`) that the admin guard
 * (`getMerchantContext`) and the store-switcher read through, plus the plan-cap gate the
 * `createStore` action re-checks server-side. The mock owner "Northbound" (`user_northbound`)
 * owns exactly ONE store whose primary subscription is `standard` (cap 10). Anything that hits
 * Mongoose directly (`resolveActiveStore`) has no mock branch and is flagged as a harness gap —
 * see the report; it is intentionally NOT exercised here.
 */

// ── storeCapForPlan: catalog contract ─────────────────────────────────────────

test("storeCapForPlan: free=1, standard=10, unknown→1 (never unlimited)", () => {
  assert.equal(storeCapForPlan("free"), 1);
  assert.equal(storeCapForPlan("standard"), 10);
  // @ts-expect-error — exercise the getPlan free-fallback against a non-catalog plan
  assert.equal(storeCapForPlan("enterprise"), 1);
  // @ts-expect-error — empty / nullish plan also falls back to the free cap
  assert.equal(storeCapForPlan(""), 1);
  // @ts-expect-error
  assert.equal(storeCapForPlan(undefined), 1);
});

// ── getStoreCapStatus: the single object the UI + create action read ───────────

test("getStoreCapStatus(MOCK_OWNER_ID): standard plan, cap 10, count 1, not at cap", async () => {
  const status = await getStoreCapStatus(MOCK_OWNER_ID);
  assert.equal(status.plan, "standard");
  assert.equal(status.cap, 10);
  assert.equal(status.count, 1);
  assert.equal(status.atCap, false);
  // exact-shape pin so a stray field can't slip in unnoticed
  assert.deepEqual(status, { plan: "standard", cap: 10, count: 1, atCap: false });
});

test("getStoreCapStatus(unknown user): free fallback, cap 1, count 0, not at cap", async () => {
  // Mock-mode behavior observed: an unknown user owns no mock store, so getAccountPlan
  // falls through `user?.primaryStoreId` → "free", and getOwnedStoreCount → 0. With
  // count 0 < cap 1, atCap is false (a brand-new free account may create its 1st store).
  const status = await getStoreCapStatus("unknown-user");
  assert.deepEqual(status, { plan: "free", cap: 1, count: 0, atCap: false });
});

test("getStoreCapStatus: empty-string userId behaves like any unknown user (free/0/1/false)", async () => {
  const status = await getStoreCapStatus("");
  assert.deepEqual(status, { plan: "free", cap: 1, count: 0, atCap: false });
});

// ── getAccountPlan: effective plan, anchored to the primary store ──────────────

test("getAccountPlan: mock owner → standard; unknown → free", async () => {
  assert.equal(await getAccountPlan(MOCK_OWNER_ID), "standard");
  assert.equal(await getAccountPlan("unknown-user"), "free");
  assert.equal(await getAccountPlan(""), "free");
});

// ── getOwnedStoreCount ─────────────────────────────────────────────────────────

test("getOwnedStoreCount: mock owner → 1; unknown → 0", async () => {
  assert.equal(await getOwnedStoreCount(MOCK_OWNER_ID), 1);
  assert.equal(await getOwnedStoreCount("unknown-user"), 0);
  assert.equal(await getOwnedStoreCount(""), 0);
});

// ── getStoresForOwner ──────────────────────────────────────────────────────────

test("getStoresForOwner: mock owner → [the mock store]; unknown → []", async () => {
  const stores = await getStoresForOwner(MOCK_OWNER_ID);
  assert.equal(stores.length, 1);
  assert.equal(stores[0]!._id, MOCK_STORE_ID);
  assert.equal(stores[0]!.ownerId, MOCK_OWNER_ID);

  assert.deepEqual(await getStoresForOwner("unknown-user"), []);
  assert.deepEqual(await getStoresForOwner(""), []);
});

test("getStoresForOwner: returns a fresh serialized copy, not a shared mutable mock", async () => {
  // Two independent calls must not alias the same object (no shared mutable state).
  const a = await getStoresForOwner(MOCK_OWNER_ID);
  const b = await getStoresForOwner(MOCK_OWNER_ID);
  assert.notEqual(a[0], b[0], "each call should serialize a fresh object");
  assert.deepEqual(a[0], b[0], "but the values must be equal");
});

// ── getUserById ────────────────────────────────────────────────────────────────

test("getUserById: mock owner → the mock user; unknown → null", async () => {
  const user = await getUserById(MOCK_OWNER_ID);
  assert.ok(user);
  assert.equal(user._id, MOCK_OWNER_ID);
  assert.equal(user.email, mockUser.email);
  assert.equal(user.primaryStoreId, MOCK_STORE_ID);

  assert.equal(await getUserById("unknown-user"), null);
  assert.equal(await getUserById(""), null);
});

// ── setActiveStore: the IDOR / ownership half (mock branch) ────────────────────

test("setActiveStore: true only for the owned mock store id", async () => {
  // Mock branch is `mockStore._id === storeId` — true exactly for the demo store.
  assert.equal(await setActiveStore(MOCK_OWNER_ID, MOCK_STORE_ID), true);
});

test("IDOR: setActiveStore is false for a store the principal does not own", async () => {
  // A foreign / non-existent store id can never become the active store.
  assert.equal(await setActiveStore(MOCK_OWNER_ID, "store_someone_else"), false);
  assert.equal(await setActiveStore(MOCK_OWNER_ID, ""), false);
});

test("IDOR: in mock mode setActiveStore keys off the store id, not the caller", async () => {
  // The mock branch only proves the store-id half of the contract: the real ownership
  // check (`store.ownerId !== userId`) is the DB path. Documenting the mock contract:
  // ANY userId paired with the mock store id returns true in mock mode.
  assert.equal(await setActiveStore("some-other-user", MOCK_STORE_ID), true);
  assert.equal(await setActiveStore("some-other-user", "store_someone_else"), false);
});
