import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDiscountAmount, validateDiscount } from "@/lib/data/discounts";
import type { Discount } from "@/types";

/**
 * Discount math + validation — EXHAUSTIVE edge cases (companion to discount.test.ts).
 *
 * `computeDiscountAmount(subtotal, discount)` is the pure money primitive applied
 * server-side at checkout. It must: round to whole cents, clamp to `[0, subtotal]`
 * (a code can NEVER make a total negative or exceed the cart), and survive hostile
 * inputs (0 / negative subtotals, >100% codes, fractional cents). `validateDiscount`
 * in MOCK MODE (no DB) is the documented contract: every code is `not_found`.
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

/* ----------------------------------------------- percentage rounding ---- */

test("percentage rounds 33.33% to whole cents across several subtotals", () => {
  // 33.33% of 100 = 33.33 (exact)
  assert.equal(computeDiscountAmount(100, disc({ type: "percentage", value: 33.33 })), 33.33);
  // 33.33% of 49.99 = 16.661667 → 16.66
  assert.equal(computeDiscountAmount(49.99, disc({ type: "percentage", value: 33.33 })), 16.66);
  // 33.33% of 7 = 2.3331 → 2.33
  assert.equal(computeDiscountAmount(7, disc({ type: "percentage", value: 33.33 })), 2.33);
});

test("percentage rounds half-up at the cent boundary (no float drift)", () => {
  // 10% of 0.05 = 0.005 → Math.round(0.5) = 1 cent → 0.01
  assert.equal(computeDiscountAmount(0.05, disc({ type: "percentage", value: 10 })), 0.01);
  // 50% of 0.01 = 0.005 → 0.01
  assert.equal(computeDiscountAmount(0.01, disc({ type: "percentage", value: 50 })), 0.01);
  // 15% of 1.15 = 0.1725 → 0.17
  assert.equal(computeDiscountAmount(1.15, disc({ type: "percentage", value: 15 })), 0.17);
});

test("classic float-trap subtotals still round to clean cents", () => {
  // 10% of 19.99 = 1.999 → 2.00
  assert.equal(computeDiscountAmount(19.99, disc({ type: "percentage", value: 10 })), 2);
  // 30% of 29.97 = 8.991 → 8.99
  assert.equal(computeDiscountAmount(29.97, disc({ type: "percentage", value: 30 })), 8.99);
});

/* ------------------------------------------------------ fixed clamps ---- */

test("a fixed discount larger than the subtotal clamps to the subtotal", () => {
  assert.equal(computeDiscountAmount(20, disc({ type: "fixed", value: 1000 })), 20);
  assert.equal(computeDiscountAmount(0.5, disc({ type: "fixed", value: 5 })), 0.5);
});

test("a fixed discount exactly equal to the subtotal zeroes the order", () => {
  assert.equal(computeDiscountAmount(40, disc({ type: "fixed", value: 40 })), 40);
});

test("fractional fixed discounts round to cents", () => {
  // raw 5.555 → 5.56, still under a 100 subtotal
  assert.equal(computeDiscountAmount(100, disc({ type: "fixed", value: 5.555 })), 5.56);
});

/* ------------------------------------------------- zero / negatives ----- */

test("a 0 subtotal yields a 0 discount for any code type", () => {
  assert.equal(computeDiscountAmount(0, disc({ type: "percentage", value: 50 })), 0);
  assert.equal(computeDiscountAmount(0, disc({ type: "fixed", value: 25 })), 0);
  assert.equal(computeDiscountAmount(0, disc({ type: "percentage", value: 0 })), 0);
});

test("a negative-valued discount can never produce a negative amount (>= 0 guard)", () => {
  // A misconfigured fixed code with a negative value would otherwise CREDIT the cart.
  assert.equal(computeDiscountAmount(50, disc({ type: "fixed", value: -10 })), 0);
  assert.equal(computeDiscountAmount(50, disc({ type: "percentage", value: -25 })), 0);
});

test("a negative subtotal is clamped: discount can never exceed it downward", () => {
  // min(round(raw), subtotal) with a negative subtotal caps the amount AT the subtotal,
  // then max(0, ...) floors it — net 0 for a percentage of a negative cart.
  const amt = computeDiscountAmount(-10, disc({ type: "percentage", value: 50 }));
  assert.equal(amt, 0);
});

/* ------------------------------------------------ 100%+ percentages ----- */

test("a 100% code zeroes exactly to the subtotal", () => {
  assert.equal(computeDiscountAmount(33.33, disc({ type: "percentage", value: 100 })), 33.33);
});

test("a >100% code is clamped to the subtotal (never a credit)", () => {
  assert.equal(computeDiscountAmount(50, disc({ type: "percentage", value: 100.01 })), 50);
  assert.equal(computeDiscountAmount(50, disc({ type: "percentage", value: 9999 })), 50);
});

/* ----------------------------------- validateDiscount mock-mode contract */

test("MOCK MODE: validateDiscount returns not_found for any code (no DB = no discounts)", async () => {
  const r = await validateDiscount("s1", "WELCOME10", 100);
  assert.deepEqual(r, { ok: false, reason: "not_found" });
});

test("MOCK MODE: an empty / whitespace code is not_found and never throws", async () => {
  for (const code of ["", "   ", "\t\n", "  SAVE  "]) {
    const r = await validateDiscount("s1", code, 100);
    assert.equal(r.ok, false);
    assert.equal((r as { reason: string }).reason, "not_found");
  }
});

test("MOCK MODE: validateDiscount is total — never rejects, regardless of subtotal", async () => {
  await assert.doesNotReject(() => validateDiscount("s1", "ANYTHING", 0));
  await assert.doesNotReject(() => validateDiscount("s1", "ANYTHING", -50));
  await assert.doesNotReject(() => validateDiscount("", "ANYTHING", 100));
});
