import { test } from "node:test";
import assert from "node:assert/strict";
import { createFulfillment, FulfillmentError } from "@/lib/data/orders";
import { mockOrders, MOCK_STORE_ID } from "@/lib/data/mocks";

/**
 * Fulfillment rollup — `createFulfillment(storeId, orderId, input)` in MOCK MODE.
 *
 * Records a shipment: adds requested quantities to each line's `fulfilledQuantity`
 * (clamped to what remains), appends a `fulfillments[]` record carrying optional
 * (trimmed) tracking, and recomputes the rollup status (unfulfilled →
 * partially_fulfilled → fulfilled). Throws on a cancelled order or when nothing
 * shippable was requested. Tests use real mock orders so the rollup math is exercised.
 *
 * Fixture map:
 *   o1042 — UNFULFILLED, 2 lines: [BD-35G ×1, GUM-MB ×2]  (total 3 units)
 *   o1038 — fulfilled, 3 lines
 *   o1039 — CANCELLED (refunded)
 */

test("partial fulfillment of one line → partially_fulfilled + line/record updated", async () => {
  // Fulfill 1 of the 2 gummies on o1042; the BD line stays at 0.
  const order = await createFulfillment(MOCK_STORE_ID, "o1042", {
    lines: [{ lineIndex: 1, quantity: 1 }],
  });
  assert.ok(order);
  assert.equal(order!.fulfillmentStatus, "partially_fulfilled");
  assert.equal(order!.lineItems[1]!.fulfilledQuantity, 1);
  assert.equal(order!.lineItems[0]!.fulfilledQuantity, 0);
  // One fulfillment record appended, carrying just the shipped line.
  assert.equal(order!.fulfillments!.length, 1);
  assert.deepEqual(order!.fulfillments![0]!.lines, [{ lineIndex: 1, quantity: 1 }]);
});

test("fulfilling EVERYTHING rolls up to fulfilled", async () => {
  const order = await createFulfillment(MOCK_STORE_ID, "o1042", {
    lines: [
      { lineIndex: 0, quantity: 1 }, // BD ×1
      { lineIndex: 1, quantity: 2 }, // GUM ×2
    ],
  });
  assert.ok(order);
  assert.equal(order!.fulfillmentStatus, "fulfilled");
  assert.equal(order!.lineItems[0]!.fulfilledQuantity, 1);
  assert.equal(order!.lineItems[1]!.fulfilledQuantity, 2);
});

test("over-requesting a line clamps to the remaining quantity", async () => {
  // Ask to ship 99 gummies when only 2 exist on the line.
  const order = await createFulfillment(MOCK_STORE_ID, "o1042", {
    lines: [{ lineIndex: 1, quantity: 99 }],
  });
  assert.ok(order);
  assert.equal(order!.lineItems[1]!.fulfilledQuantity, 2); // clamped to qty
  assert.deepEqual(order!.fulfillments![0]!.lines, [{ lineIndex: 1, quantity: 2 }]);
});

test("all-zero / over-only / empty requests throw (nothing shippable)", async () => {
  // Zero quantities.
  await assert.rejects(
    () => createFulfillment(MOCK_STORE_ID, "o1042", { lines: [{ lineIndex: 0, quantity: 0 }] }),
    FulfillmentError,
  );
  // Out-of-range line index only.
  await assert.rejects(
    () => createFulfillment(MOCK_STORE_ID, "o1042", { lines: [{ lineIndex: 99, quantity: 5 }] }),
    FulfillmentError,
  );
  // Empty lines array.
  await assert.rejects(
    () => createFulfillment(MOCK_STORE_ID, "o1042", { lines: [] }),
    (err: unknown) =>
      err instanceof FulfillmentError && /Nothing left to fulfill/.test((err as Error).message),
  );
  // Negative quantity (Math.max(0, ...) → 0 → dropped).
  await assert.rejects(
    () => createFulfillment(MOCK_STORE_ID, "o1042", { lines: [{ lineIndex: 0, quantity: -3 }] }),
    FulfillmentError,
  );
});

test("a cancelled order refuses fulfillment", async () => {
  // o1039 is refunded + cancelled.
  await assert.rejects(
    () => createFulfillment(MOCK_STORE_ID, "o1039", { lines: [{ lineIndex: 0, quantity: 1 }] }),
    (err: unknown) =>
      err instanceof FulfillmentError && /cancelled/i.test((err as Error).message),
  );
});

test("optional tracking fields are trimmed and only included when non-empty", async () => {
  const order = await createFulfillment(MOCK_STORE_ID, "o1042", {
    lines: [{ lineIndex: 0, quantity: 1 }],
    trackingNumber: "  1Z999  ",
    carrier: "  UPS ",
    trackingUrl: "   ", // whitespace-only → omitted
  });
  const rec = order!.fulfillments![0]!;
  assert.equal(rec.trackingNumber, "1Z999"); // trimmed
  assert.equal(rec.carrier, "UPS");
  assert.equal("trackingUrl" in rec, false); // blank → not included
});

test("with no tracking supplied at all, no tracking keys appear on the record", async () => {
  const order = await createFulfillment(MOCK_STORE_ID, "o1042", {
    lines: [{ lineIndex: 0, quantity: 1 }],
  });
  const rec = order!.fulfillments![0]!;
  assert.equal("trackingNumber" in rec, false);
  assert.equal("carrier" in rec, false);
  assert.equal("trackingUrl" in rec, false);
  assert.ok(rec.id);
  assert.ok(rec.createdAt);
});

test("a fractional requested quantity is floored before clamping", async () => {
  const order = await createFulfillment(MOCK_STORE_ID, "o1042", {
    lines: [{ lineIndex: 1, quantity: 1.9 }],
  });
  assert.equal(order!.lineItems[1]!.fulfilledQuantity, 1); // 1.9 → 1
});

test("fulfilling an order that isn't this store's returns null (tenant-scoped)", async () => {
  const order = await createFulfillment("store_other", "o1042", {
    lines: [{ lineIndex: 0, quantity: 1 }],
  });
  assert.equal(order, null);
});

test("REGRESSION: fulfilling the same order twice does not mutate the shared fixture", async () => {
  // Each call reads a fresh clone; the underlying mockOrders must stay pristine so
  // tests are order-independent. Run two partials and assert the fixture is untouched.
  await createFulfillment(MOCK_STORE_ID, "o1042", { lines: [{ lineIndex: 0, quantity: 1 }] });
  await createFulfillment(MOCK_STORE_ID, "o1042", { lines: [{ lineIndex: 1, quantity: 2 }] });
  const fixture = mockOrders.find((o) => o._id === "o1042")!;
  assert.equal(fixture.fulfillmentStatus, "unfulfilled");
  assert.equal(fixture.lineItems[0]!.fulfilledQuantity ?? 0, 0);
  assert.equal(fixture.lineItems[1]!.fulfilledQuantity ?? 0, 0);
  assert.equal(fixture.fulfillments ?? undefined, undefined);
});
