import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyGiftCard,
  giftCardState,
  generateGiftCardCode,
} from "@/lib/data/gift-cards";

/** Gift cards (Phase 4) — redemption math + redeemability classification. */

test("applyGiftCard draws the lesser of balance and amount due", () => {
  // Card covers part of the order.
  assert.deepEqual(applyGiftCard(20, 50), { applied: 20, remainingBalance: 0, remainingDue: 30 });
  // Card more than covers it — leftover stays on the card.
  assert.deepEqual(applyGiftCard(80, 50), { applied: 50, remainingBalance: 30, remainingDue: 0 });
  // Exact.
  assert.deepEqual(applyGiftCard(50, 50), { applied: 50, remainingBalance: 0, remainingDue: 0 });
});

test("applyGiftCard never goes negative", () => {
  assert.deepEqual(applyGiftCard(0, 50), { applied: 0, remainingBalance: 0, remainingDue: 50 });
  assert.deepEqual(applyGiftCard(20, 0), { applied: 0, remainingBalance: 20, remainingDue: 0 });
});

test("giftCardState classifies redeemability", () => {
  const NOW = 1_700_000_000_000;
  assert.equal(giftCardState({ status: "active", balance: 10, expiresAt: null }, NOW), "valid");
  assert.equal(giftCardState({ status: "disabled", balance: 10, expiresAt: null }, NOW), "disabled");
  assert.equal(giftCardState({ status: "active", balance: 0, expiresAt: null }, NOW), "empty");
  assert.equal(
    giftCardState({ status: "active", balance: 10, expiresAt: new Date(NOW - 1000).toISOString() }, NOW),
    "expired",
  );
});

test("generateGiftCardCode is GIFT-XXXX-XXXX-XXXX with no ambiguous chars", () => {
  const code = generateGiftCardCode(() => 0.5);
  assert.match(code, /^GIFT-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.ok(!/[01OI]/.test(code.replace("GIFT-", "")));
});
