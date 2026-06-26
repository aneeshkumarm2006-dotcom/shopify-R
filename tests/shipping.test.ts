import { test } from "node:test";
import assert from "node:assert/strict";
import { availableShippingRates, resolveShippingRate } from "@/lib/data/shipping";
import type { ShippingSettings } from "@/types";

/**
 * Shipping engine (Phase 2). A store with no/disabled shipping always gets a single
 * free "Standard" fallback; configured rates resolve their effective price by
 * free-shipping threshold + region; resolving a rate never trusts a client price.
 */

test("undefined settings ⇒ single free Standard rate", () => {
  const rates = availableShippingRates(undefined, { subtotal: 100 });
  assert.deepEqual(rates, [{ id: "standard", label: "Standard", price: 0 }]);
});

test("disabled or empty settings ⇒ free Standard fallback", () => {
  assert.equal(availableShippingRates({ enabled: false, rates: [] }, { subtotal: 100 })[0]!.price, 0);
  assert.equal(availableShippingRates({ enabled: true, rates: [] }, { subtotal: 100 })[0]!.id, "standard");
});

const SETTINGS: ShippingSettings = {
  enabled: true,
  rates: [
    { id: "std", label: "Standard", price: 5, freeOver: 75 },
    { id: "exp", label: "Express", price: 15 },
    { id: "local", label: "Local pickup", price: 0, regions: ["OR"] },
  ],
};

test("flat rates surface their price", () => {
  const rates = availableShippingRates(SETTINGS, { subtotal: 50, region: "OR" });
  assert.equal(rates.find((r) => r.id === "std")!.price, 5);
  assert.equal(rates.find((r) => r.id === "exp")!.price, 15);
});

test("freeOver zeroes a rate once the subtotal threshold is met", () => {
  const below = availableShippingRates(SETTINGS, { subtotal: 50, region: "OR" });
  assert.equal(below.find((r) => r.id === "std")!.price, 5);
  const above = availableShippingRates(SETTINGS, { subtotal: 80, region: "OR" });
  assert.equal(above.find((r) => r.id === "std")!.price, 0);
});

test("region-restricted rates only appear for matching regions", () => {
  const inRegion = availableShippingRates(SETTINGS, { subtotal: 50, region: "OR" });
  assert.ok(inRegion.some((r) => r.id === "local"));
  const outRegion = availableShippingRates(SETTINGS, { subtotal: 50, region: "CA" });
  assert.ok(!outRegion.some((r) => r.id === "local"));
});

test("resolveShippingRate honors the chosen id, re-pricing server-side", () => {
  const chosen = resolveShippingRate(SETTINGS, { subtotal: 80, region: "OR", rateId: "std" });
  assert.equal(chosen.price, 0); // freeOver applied server-side regardless of client
});

test("resolveShippingRate falls back to the first available rate for an unknown id", () => {
  const chosen = resolveShippingRate(SETTINGS, { subtotal: 50, region: "CA", rateId: "bogus" });
  assert.equal(chosen.id, "std");
});
