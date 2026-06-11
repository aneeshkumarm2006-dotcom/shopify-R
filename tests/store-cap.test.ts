import { test } from "node:test";
import assert from "node:assert/strict";
import { storeCapForPlan, PLAN_CATALOG } from "../lib/payments/billing";

/**
 * Premium store-cap tests (multi-store gating). The cap catalog is the single source
 * of truth the `createStore` action re-checks server-side; these pin its contract
 * without a live DB (the ownership/active-store paths hit Mongoose and are exercised
 * manually). `atCap` is derived as `count >= cap`, so the boundary cases below mirror
 * exactly when the action returns `upgrade_required`.
 */

test("storeCapForPlan: free is single-store, standard unlocks 10", () => {
  assert.equal(storeCapForPlan("free"), 1);
  assert.equal(storeCapForPlan("standard"), 10);
});

test("storeCapForPlan: an unknown plan falls back to the free cap (1), never unlimited", () => {
  // @ts-expect-error — exercising the getPlan fallback against a non-catalog plan
  assert.equal(storeCapForPlan("enterprise"), 1);
});

test("every plan in the catalog carries a concrete storeCap ≥ 1", () => {
  for (const plan of Object.values(PLAN_CATALOG)) {
    assert.equal(typeof plan.storeCap, "number");
    assert.ok(plan.storeCap >= 1, `${plan.id} storeCap must be ≥ 1`);
  }
});

test("CAP GATE: atCap === (count >= cap) at the free boundary (1 store)", () => {
  const cap = storeCapForPlan("free"); // 1
  assert.equal(0 >= cap, false); // no stores yet → may create
  assert.equal(1 >= cap, true); // owns 1 → at cap, create blocked (upgrade_required)
});

test("CAP GATE: atCap === (count >= cap) at the standard boundary (10 stores)", () => {
  const cap = storeCapForPlan("standard"); // 10
  assert.equal(9 >= cap, false); // 9 owned → may create the 10th
  assert.equal(10 >= cap, true); // 10 owned → at cap, create blocked
});
