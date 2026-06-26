import { test } from "node:test";
import assert from "node:assert/strict";
import { placeOrder, CheckoutError } from "@/lib/data/checkout";
import { mockProducts, MOCK_STORE_ID } from "@/lib/data/mocks";
import type { Address } from "@/types";
import type { CheckoutInput, CheckoutLine } from "@/lib/data/checkout";

/**
 * Phase 2 — real-time stock check + total breakdown, in MOCK MODE (mockStore has no
 * tax/shipping config, so shipping is the free "Standard" fallback and tax is 0; the
 * tax/shipping MATH is unit-tested separately in tax.test.ts / shipping.test.ts).
 *
 * Fixtures used: p7-v1 (qty 3, `deny`), p2-v1 (qty 0, `deny`), p5-v1 (qty 210,
 * `continue` ⇒ oversell allowed).
 */

const ADDR: Address = { name: "Test Buyer", email: "buyer@example.com", address: "1 Test St" };
function input(lines: CheckoutLine[], extra: Partial<CheckoutInput> = {}): CheckoutInput {
  return { contact: ADDR, shippingAddress: ADDR, ageVerifiedAt: "2026-06-12T00:00:00.000Z", lines, ...extra };
}

test("ordering within stock on a deny variant succeeds (p7-v1: 3 of 3)", async () => {
  const placed = await placeOrder(MOCK_STORE_ID, input([{ productId: "p7", variantId: "p7-v1", quantity: 3 }]));
  assert.equal(placed.lineItems[0]!.quantity, 3);
});

test("oversell on a deny variant throws CheckoutError (p7-v1: 4 of 3)", async () => {
  await assert.rejects(
    () => placeOrder(MOCK_STORE_ID, input([{ productId: "p7", variantId: "p7-v1", quantity: 4 }])),
    (err: unknown) => err instanceof CheckoutError && /Only 3/.test((err as Error).message),
  );
});

test("quantity is aggregated across lines before the stock check (2 + 2 > 3 throws)", async () => {
  await assert.rejects(
    () =>
      placeOrder(
        MOCK_STORE_ID,
        input([
          { productId: "p7", variantId: "p7-v1", quantity: 2 },
          { productId: "p7", variantId: "p7-v1", quantity: 2 },
        ]),
      ),
    CheckoutError,
  );
});

test("an out-of-stock deny variant is rejected (p2-v1: 0 on hand)", async () => {
  await assert.rejects(
    () => placeOrder(MOCK_STORE_ID, input([{ productId: "p2", variantId: "p2-v1", quantity: 1 }])),
    (err: unknown) => err instanceof CheckoutError && /out of stock/.test((err as Error).message),
  );
});

test("a `continue`-policy variant may be oversold (p5-v1 beyond on-hand succeeds)", async () => {
  const placed = await placeOrder(MOCK_STORE_ID, input([{ productId: "p5", variantId: "p5-v1", quantity: 9999 }]));
  assert.equal(placed.lineItems[0]!.quantity, 9999);
});

test("placed order exposes the full total breakdown; unconfigured store ⇒ free Standard shipping, 0 tax", async () => {
  const placed = await placeOrder(MOCK_STORE_ID, input([{ productId: "p1", variantId: "p1-v2", quantity: 2 }]));
  assert.equal(placed.subtotal, 78 * 2);
  assert.equal(placed.discountAmount, 0);
  assert.equal(placed.shippingTotal, 0);
  assert.equal(placed.shippingMethod, "Standard");
  assert.equal(placed.taxTotal, 0);
  assert.equal(placed.total, placed.subtotal); // no discount/shipping/tax → equals subtotal
});
