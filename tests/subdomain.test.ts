import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseStoreSubdomain,
  isDnsSafeSubdomain,
  isStorefrontPath,
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

/**
 * Storefront-only lockdown (§9). A custom domain / `/s/<sub>` request may serve ONLY
 * the storefront — the middleware redirects everything else to the shop home so the
 * platform admin/login never renders under a merchant's branded domain. These pin the
 * allowlist: customer paths pass, platform/admin/auth paths are blocked, and the
 * /products & /collections collision (admin list vs storefront handle) is respected.
 */
test("isStorefrontPath ALLOWS customer-facing storefront paths", () => {
  for (const p of [
    "/",
    "/preview",
    "/cart",
    "/checkout",
    "/search",
    "/account",
    "/order-confirmation",
    "/products/cool-shirt",
    "/collections/summer",
    "/pages/about",
  ]) {
    assert.equal(isStorefrontPath(p), true, `${p} should be allowed`);
  }
});

test("isStorefrontPath BLOCKS merchant/admin/platform/auth paths on a custom domain", () => {
  for (const p of [
    "/sign-in",
    "/dashboard",
    "/onboarding",
    "/orders",
    "/orders/o1",
    "/customers",
    "/settings",
    "/settings/domains",
    "/inventory",
    "/discounts",
    "/gift-cards",
    "/marketing",
    "/reviews",
    "/analytics",
    "/staff",
    "/builder",
    "/publish",
    "/locations",
    "/platform",
    "/platform/users",
    "/api/auth/signin",
    "/api/auth/callback/google",
    // /products & /collections collisions: bare list + editors are ADMIN.
    "/products",
    "/products/new",
    "/products/edit/p1",
    "/collections",
    "/collections/new",
    "/collections/edit/c1",
  ]) {
    assert.equal(isStorefrontPath(p), false, `${p} should be blocked`);
  }
});
