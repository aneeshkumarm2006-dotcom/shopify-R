import { test } from "node:test";
import assert from "node:assert/strict";
import {
  funnelRates,
  referrerSource,
  buildReferrerBreakdown,
  buildCohorts,
  topProductsFromOrders,
} from "@/lib/data/analytics-insights";

/** Deeper analytics (Phase 6) — funnel, attribution, cohorts, top products. */

test("funnelRates computes step + overall conversion", () => {
  const r = funnelRates(100, 25, 10);
  assert.equal(r.viewToCart, 25);
  assert.equal(r.cartToOrder, 40);
  assert.equal(r.viewToOrder, 10);
});

test("funnelRates avoids divide-by-zero", () => {
  assert.deepEqual(funnelRates(0, 0, 0), { viewToCart: 0, cartToOrder: 0, viewToOrder: 0 });
});

test("referrerSource normalizes hosts and treats blanks as Direct", () => {
  assert.equal(referrerSource("https://www.google.com/search?q=x"), "google.com");
  assert.equal(referrerSource("https://t.co/abc"), "t.co");
  assert.equal(referrerSource(""), "Direct");
  assert.equal(referrerSource(null), "Direct");
});

test("buildReferrerBreakdown ranks sources with share-of-total", () => {
  const rows = buildReferrerBreakdown([
    "https://google.com",
    "https://google.com",
    null,
    "https://insta.com",
  ]);
  assert.equal(rows[0]!.source, "google.com");
  assert.equal(rows[0]!.count, 2);
  assert.equal(rows[0]!.pct, 50);
});

test("buildCohorts groups by join month with repeat rate, newest first", () => {
  const cohorts = buildCohorts([
    { createdAt: "2026-01-05T00:00:00.000Z", orderCount: 3 },
    { createdAt: "2026-01-20T00:00:00.000Z", orderCount: 1 },
    { createdAt: "2026-02-01T00:00:00.000Z", orderCount: 2 },
  ]);
  assert.equal(cohorts[0]!.month, "2026-02"); // newest first
  const jan = cohorts.find((c) => c.month === "2026-01")!;
  assert.equal(jan.count, 2);
  assert.equal(jan.repeat, 1); // one of the two ordered >1
  assert.equal(jan.repeatRate, 50);
});

test("topProductsFromOrders aggregates units + revenue, descending", () => {
  const top = topProductsFromOrders([
    { lineItems: [{ title: "A", variant: "", sku: "", price: 10, quantity: 2 }] },
    { lineItems: [{ title: "A", variant: "", sku: "", price: 10, quantity: 1 }, { title: "B", variant: "", sku: "", price: 5, quantity: 10 }] },
  ]);
  assert.equal(top[0]!.title, "B"); // 10 units beats A's 3
  assert.equal(top.find((t) => t.title === "A")!.units, 3);
  assert.equal(top.find((t) => t.title === "A")!.revenue, 30);
});
