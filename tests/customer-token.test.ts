import { test } from "node:test";
import assert from "node:assert/strict";
import { createCustomerToken, parseCustomerToken } from "@/lib/customer/token";

/**
 * Storefront customer session token (Phase 3). The token binds a customer to a store
 * and is signed (HMAC) + time-boxed. These pin the round-trip, tamper rejection,
 * store-binding, and expiry — the guarantees the per-store cookie session rests on.
 */

const NOW = 1_700_000_000_000; // fixed clock for deterministic expiry tests
const DAY = 24 * 60 * 60 * 1000;

test("round-trips the customer + store binding", () => {
  const token = createCustomerToken("cust_1", "store_a", NOW);
  const parsed = parseCustomerToken(token, NOW);
  assert.deepEqual(parsed, { customerId: "cust_1", storeId: "store_a" });
});

test("a tampered signature is rejected", () => {
  const token = createCustomerToken("cust_1", "store_a", NOW);
  const broken = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  assert.equal(parseCustomerToken(broken, NOW), null);
});

test("a tampered payload (forged storeId) fails the signature check", () => {
  const token = createCustomerToken("cust_1", "store_a", NOW);
  const sig = token.slice(token.lastIndexOf(".") + 1);
  const forged = Buffer.from("cust_1:store_b:" + (NOW + DAY), "utf8").toString("base64url");
  assert.equal(parseCustomerToken(`${forged}.${sig}`, NOW), null);
});

test("an expired token is rejected", () => {
  const token = createCustomerToken("cust_1", "store_a", NOW);
  assert.ok(parseCustomerToken(token, NOW + 29 * DAY)); // still valid
  assert.equal(parseCustomerToken(token, NOW + 31 * DAY), null); // past 30-day TTL
});

test("malformed / empty tokens return null", () => {
  assert.equal(parseCustomerToken(undefined, NOW), null);
  assert.equal(parseCustomerToken("", NOW), null);
  assert.equal(parseCustomerToken("not-a-token", NOW), null);
  assert.equal(parseCustomerToken("only.", NOW), null);
});

test("the embedded storeId is exposed so the caller can enforce tenant binding", () => {
  const token = createCustomerToken("cust_1", "store_a", NOW);
  const parsed = parseCustomerToken(token, NOW);
  // A session for store_a must NOT be accepted while resolving store_b.
  assert.notEqual(parsed?.storeId, "store_b");
});
