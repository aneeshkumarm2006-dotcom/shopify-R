import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseStoreSubdomain,
  isDnsSafeSubdomain,
  RESERVED_SUBDOMAINS,
} from "../lib/tenant/host";

/**
 * Subdomain blocklist + host-resolution tests (Stage 14, PRD §9).
 *
 * The reserved-word list and DNS-safe rule are the abuse guardrail: a tenant must
 * not be able to claim `admin`, `api`, … (which would shadow the platform shell) or
 * a malformed label. `parseStoreSubdomain` (used by the Edge middleware) must resolve
 * reserved/invalid hosts to `null` ("serve the app, not a storefront").
 */

test("DNS-safe rule accepts ordinary labels, rejects malformed ones", () => {
  for (const ok of ["acme", "blue-bottle", "a1b", "shop123", "x"]) {
    assert.equal(isDnsSafeSubdomain(ok), true, `${ok} should be valid`);
  }
  for (const bad of ["-acme", "acme-", "Acme", "a_b", "a.b", "", "a b", "café"]) {
    assert.equal(isDnsSafeSubdomain(bad), false, `${bad} should be invalid`);
  }
});

test("every reserved label is refused by the host resolver", () => {
  for (const reserved of RESERVED_SUBDOMAINS) {
    assert.equal(
      parseStoreSubdomain(`${reserved}.ourapp.com`),
      null,
      `${reserved} must not resolve to a tenant`,
    );
  }
});

test("the apex domain and www resolve to the app, not a store", () => {
  assert.equal(parseStoreSubdomain("ourapp.com"), null);
  assert.equal(parseStoreSubdomain("www.ourapp.com"), null);
});

test("a normal subdomain resolves to its store label", () => {
  assert.equal(parseStoreSubdomain("acme.ourapp.com"), "acme");
  assert.equal(parseStoreSubdomain("acme.ourapp.com:3000"), "acme"); // port stripped
  assert.equal(parseStoreSubdomain("acme.localhost"), "acme"); // dev host
});

test("unrelated hosts (e.g. *.vercel.app) never resolve to a tenant", () => {
  assert.equal(parseStoreSubdomain("offshelf.vercel.app"), null);
  assert.equal(parseStoreSubdomain(null), null);
  assert.equal(parseStoreSubdomain(undefined), null);
});

test("malformed leftmost label is rejected even under the app domain", () => {
  assert.equal(parseStoreSubdomain("-bad.ourapp.com"), null);
  assert.equal(parseStoreSubdomain("bad_label.ourapp.com"), null); // underscore not DNS-safe
});

test("host casing is normalized — an uppercase label resolves to its lowercase store", () => {
  // The resolver lowercases the host first, so case never blocks a legitimate store.
  assert.equal(parseStoreSubdomain("ACME.ourapp.com"), "acme");
});
