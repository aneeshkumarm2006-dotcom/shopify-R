import { test } from "node:test";
import assert from "node:assert/strict";
import { placeOrder, CheckoutError } from "@/lib/data/checkout";
import { mockProducts, MOCK_STORE_ID } from "@/lib/data/mocks";
import type { Address } from "@/types";
import type { CheckoutInput, CheckoutLine } from "@/lib/data/checkout";

/**
 * Checkout orchestration — `placeOrder(storeId, input)` in MOCK MODE.
 *
 * This is the anti-tamper core: the client is trusted with ONLY
 * `(productId, variantId, quantity)`; every price/title/SKU and the order total are
 * re-derived from the store's own catalog. These tests pin that authority, the
 * silent drop of foreign/stale lines, quantity normalization, settlement defaulting,
 * and the mock-mode discount contract — all without a live DB (the seams take their
 * mock branches but still run the REAL filtering / pricing logic).
 */

const ADDR: Address = {
  name: "Test Buyer",
  email: "buyer@example.com",
  phone: "(555) 555-0100",
  address: "1 Test St, Portland, OR 97201",
};

function input(lines: CheckoutLine[], extra: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    contact: ADDR,
    shippingAddress: ADDR,
    ageVerifiedAt: "2026-06-12T00:00:00.000Z",
    lines,
    ...extra,
  };
}

/** Re-derive a variant's authoritative price straight from the fixtures. */
function variantPrice(productId: string, variantId: string): number {
  const p = mockProducts.find((p) => p._id === productId)!;
  const v = p.variants.find((v) => v.id === variantId)!;
  return v.price;
}

/* ------------------------------------------------------- empty cart ----- */

test("empty cart (lines: []) throws CheckoutError", async () => {
  await assert.rejects(() => placeOrder(MOCK_STORE_ID, input([])), CheckoutError);
});

/* --------------------------------------------------- price authority ---- */

test("PRICE AUTHORITY: total comes from the catalog variant, not the client", async () => {
  // p1-v2 (Blue Dream 3.5g) is 78 in the fixtures.
  const expected = variantPrice("p1", "p1-v2"); // 78
  const placed = await placeOrder(
    MOCK_STORE_ID,
    input([{ productId: "p1", variantId: "p1-v2", quantity: 2 }]),
  );
  assert.equal(placed.total, expected * 2);
  assert.equal(placed.lineItems[0]!.price, expected);
  assert.equal(placed.lineItems[0]!.quantity, 2);
});

test("PRICE AUTHORITY: a bogus client `price` field cannot change what's charged", async () => {
  const expected = variantPrice("p5", "p5-v1"); // Gummies = 22
  // Smuggle a fake price (and a fake total) into the line — must be ignored.
  const tampered = {
    productId: "p5",
    variantId: "p5-v1",
    quantity: 1,
    price: 0.01,
    total: 0.01,
  } as unknown as CheckoutLine;
  const placed = await placeOrder(MOCK_STORE_ID, input([tampered]));
  assert.equal(placed.lineItems[0]!.price, expected);
  assert.equal(placed.total, expected);
});

/* ------------------------------------------ foreign / stale line drop --- */

test("a line for a product not in this store is silently dropped", async () => {
  // p1 is real; "nope" is not. Only p1 survives.
  const placed = await placeOrder(
    MOCK_STORE_ID,
    input([
      { productId: "nope", variantId: "x", quantity: 1 },
      { productId: "p1", variantId: "p1-v1", quantity: 1 },
    ]),
  );
  assert.equal(placed.lineItems.length, 1);
  assert.equal(placed.lineItems[0]!.price, variantPrice("p1", "p1-v1"));
});

test("a line with a real product but a non-existent variantId is silently dropped", async () => {
  const placed = await placeOrder(
    MOCK_STORE_ID,
    input([
      { productId: "p1", variantId: "p1-vZZZ", quantity: 1 }, // stale variant
      { productId: "p3", variantId: "p3-v1", quantity: 1 }, // valid
    ]),
  );
  assert.equal(placed.lineItems.length, 1);
  assert.equal(placed.lineItems[0]!.sku, "SD-35G");
});

test("when ALL lines are invalid, checkout throws (None of the items...)", async () => {
  await assert.rejects(
    () =>
      placeOrder(
        MOCK_STORE_ID,
        input([
          { productId: "nope", variantId: "x", quantity: 1 },
          { productId: "p1", variantId: "ghost", quantity: 2 },
        ]),
      ),
    (err: unknown) => err instanceof CheckoutError && /None of the items/.test((err as Error).message),
  );
});

test("a foreign storeId can't reach this store's catalog → no valid lines → throws", async () => {
  // Placing for a different store: getProductsByIds(storeId) is scoped, so p1 isn't found.
  await assert.rejects(
    () => placeOrder("store_other", input([{ productId: "p1", variantId: "p1-v1", quantity: 1 }])),
    CheckoutError,
  );
});

/* ----------------------------------------------- quantity normalization */

test("quantity is normalized to Math.max(1, Math.floor(q))", async () => {
  const price = variantPrice("p5", "p5-v1");
  const cases: { q: number; expect: number }[] = [
    { q: 0, expect: 1 }, // 0 → floored up to 1
    { q: -5, expect: 1 }, // negative → 1
    { q: 2.7, expect: 2 }, // fractional floored
    { q: 1.999, expect: 1 },
    { q: 3, expect: 3 },
  ];
  for (const c of cases) {
    const placed = await placeOrder(
      MOCK_STORE_ID,
      input([{ productId: "p5", variantId: "p5-v1", quantity: c.q }]),
    );
    assert.equal(placed.lineItems[0]!.quantity, c.expect, `qty ${c.q} → ${c.expect}`);
    assert.equal(placed.total, price * c.expect);
  }
});

/* ------------------------------------------------- multi-line subtotal -- */

test("multi-line subtotal/total sums each variant's catalog price × quantity", async () => {
  const lines: CheckoutLine[] = [
    { productId: "p1", variantId: "p1-v3", quantity: 1 }, // 140
    { productId: "p4", variantId: "p4-v1", quantity: 2 }, // 48 × 2 = 96
    { productId: "p5", variantId: "p5-v1", quantity: 3 }, // 22 × 3 = 66
  ];
  const expected =
    variantPrice("p1", "p1-v3") * 1 +
    variantPrice("p4", "p4-v1") * 2 +
    variantPrice("p5", "p5-v1") * 3;
  const placed = await placeOrder(MOCK_STORE_ID, input(lines));
  assert.equal(placed.lineItems.length, 3);
  assert.equal(placed.total, expected); // 140 + 96 + 66 = 302
});

/* --------------------------------------------------- settlement default */

test("with no settlementMethod, the order places (defaults to online, enabled by default)", async () => {
  const placed = await placeOrder(
    MOCK_STORE_ID,
    input([{ productId: "p1", variantId: "p1-v1", quantity: 1 }]),
  );
  assert.ok(placed.orderId);
  assert.ok(Number.isInteger(placed.orderNumber));
});

/* ------------------------------------------------ discount in mock mode */

test("a discountCode in mock mode applies $0 (validateDiscount not_found) and the order still places", async () => {
  const price = variantPrice("p1", "p1-v2"); // 78
  const placed = await placeOrder(
    MOCK_STORE_ID,
    input([{ productId: "p1", variantId: "p1-v2", quantity: 1 }], { discountCode: "FREESTUFF" }),
  );
  // No discount could be conjured client-side: total === subtotal.
  assert.equal(placed.total, price);
  assert.ok(placed.orderId);
});

/* ----------------------------------------------------- returned shape -- */

test("placed order returns { orderId, orderNumber, total, lineItems } with full snapshots", async () => {
  const placed = await placeOrder(
    MOCK_STORE_ID,
    input([{ productId: "p1", variantId: "p1-v2", quantity: 2 }]),
  );
  assert.equal(typeof placed.orderId, "string");
  assert.ok(placed.orderId.length > 0);
  assert.equal(typeof placed.orderNumber, "number");
  assert.equal(typeof placed.total, "number");
  assert.ok(Array.isArray(placed.lineItems));
  const li = placed.lineItems[0]!;
  assert.equal(li.title, "Blue Dream · 1g");
  assert.equal(li.variant, "3.5g"); // multi-variant product → variant title carried
  assert.equal(li.sku, "BD-35G");
  assert.equal(li.price, 78);
  assert.equal(li.quantity, 2);
});

test("a single-variant product carries an empty variant label in the snapshot", async () => {
  // p2 (CBD tincture) has exactly one variant → `variant` field should be "".
  const placed = await placeOrder(
    MOCK_STORE_ID,
    input([{ productId: "p2", variantId: "p2-v1", quantity: 1 }]),
  );
  assert.equal(placed.lineItems[0]!.variant, "");
  assert.equal(placed.lineItems[0]!.sku, "CBD-30");
});
