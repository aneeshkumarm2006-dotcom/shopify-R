import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDiscountAmount } from "../lib/data/discounts";
import type { Discount } from "../types";

/**
 * Discount math (the money-critical, client-untrusted piece). `computeDiscountAmount`
 * is pure; the full `validateDiscount` gate (window/min/usage) hits the DB and is
 * exercised manually. These pin the arithmetic + the clamp that prevents negatives.
 */

function disc(partial: Partial<Discount>): Discount {
  return {
    _id: "d1",
    storeId: "s1",
    code: "SAVE",
    type: "percentage",
    value: 10,
    minSubtotal: 0,
    usageLimit: null,
    usedCount: 0,
    startsAt: null,
    endsAt: null,
    status: "active",
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

test("percentage discount takes value% of subtotal", () => {
  assert.equal(computeDiscountAmount(100, disc({ type: "percentage", value: 20 })), 20);
  assert.equal(computeDiscountAmount(50, disc({ type: "percentage", value: 10 })), 5);
});

test("percentage rounds to whole cents (no float drift)", () => {
  // 33.33% of 10 = 3.333 → 3.33
  assert.equal(computeDiscountAmount(10, disc({ type: "percentage", value: 33.33 })), 3.33);
});

test("fixed discount is a flat amount", () => {
  assert.equal(computeDiscountAmount(100, disc({ type: "fixed", value: 15 })), 15);
});

test("a discount can never exceed the subtotal (no negative totals)", () => {
  assert.equal(computeDiscountAmount(10, disc({ type: "fixed", value: 50 })), 10);
  assert.equal(computeDiscountAmount(0, disc({ type: "percentage", value: 50 })), 0);
});

test("a 100% code zeroes the order but never goes below zero", () => {
  assert.equal(computeDiscountAmount(42, disc({ type: "percentage", value: 100 })), 42);
  assert.equal(computeDiscountAmount(42, disc({ type: "percentage", value: 150 })), 42);
});
