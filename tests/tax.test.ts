import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTax, taxRateFor, taxLabel } from "@/lib/data/tax";
import type { TaxSettings } from "@/types";

/**
 * Tax engine (Phase 2). Pure math: a store with no/disabled tax charges ZERO, the
 * default rate applies to the discounted subtotal, region overrides win, shipping is
 * taxed only when opted in, and amounts round to cents.
 */

test("undefined settings ⇒ zero tax", () => {
  assert.equal(computeTax(undefined, { subtotal: 100 }), 0);
});

test("disabled settings ⇒ zero tax", () => {
  const s: TaxSettings = { enabled: false, rate: 10 };
  assert.equal(computeTax(s, { subtotal: 100 }), 0);
});

test("default rate applies to the (post-discount) subtotal", () => {
  const s: TaxSettings = { enabled: true, rate: 8.5 };
  assert.equal(computeTax(s, { subtotal: 200 }), 17); // 200 * 8.5%
});

test("a region override beats the default rate (case-insensitive)", () => {
  const s: TaxSettings = { enabled: true, rate: 5, regionRates: [{ region: "CA", rate: 9 }] };
  assert.equal(taxRateFor(s, "ca"), 9);
  assert.equal(taxRateFor(s, "OR"), 5); // no override → default
  assert.equal(computeTax(s, { subtotal: 100, region: "CA" }), 9);
});

test("shipping is taxed only when appliesToShipping is set", () => {
  const off: TaxSettings = { enabled: true, rate: 10 };
  assert.equal(computeTax(off, { subtotal: 100, shipping: 50 }), 10); // shipping excluded
  const on: TaxSettings = { enabled: true, rate: 10, appliesToShipping: true };
  assert.equal(computeTax(on, { subtotal: 100, shipping: 50 }), 15); // (100+50) * 10%
});

test("tax rounds to cents", () => {
  const s: TaxSettings = { enabled: true, rate: 7.25 };
  assert.equal(computeTax(s, { subtotal: 19.99 }), 1.45); // 1.449... → 1.45
});

test("taxLabel falls back to 'Tax'", () => {
  assert.equal(taxLabel(undefined), "Tax");
  assert.equal(taxLabel({ enabled: true, rate: 5, label: "VAT" }), "VAT");
  assert.equal(taxLabel({ enabled: true, rate: 5, label: "  " }), "Tax");
});
