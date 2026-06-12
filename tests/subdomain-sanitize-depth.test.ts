import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStoreSubdomain, isDnsSafeSubdomain } from "@/lib/tenant/host";
import {
  sanitizeInjectedHtml,
  sanitizeInjectedCss,
  sanitizeInjectedJs,
  sanitizeHtmlFragment,
} from "@/lib/sanitize/inject";

/**
 * Depth coverage for the subdomain resolver + code-injection sanitizers
 * (companion to `tests/subdomain.test.ts` / `tests/sanitize.test.ts`, PRD §9).
 *
 * The default APP_DOMAIN is "ourapp.com" (NEXT_PUBLIC_APP_DOMAIN unset in tests). These
 * cases pin the DNS-label boundaries (the 63-char limit, edge hyphens), host normalization
 * (case, :port, multi-level nesting), and the sanitizer breakout/length-cap boundaries the
 * existing files don't reach.
 */

// ─────────────────────────────── subdomain depth ──────────────────────────────

test("isDnsSafeSubdomain: 63-char label is the max valid length; 64 is rejected", () => {
  assert.equal(isDnsSafeSubdomain("a".repeat(63)), true, "63 chars is the DNS label max");
  assert.equal(isDnsSafeSubdomain("a".repeat(64)), false, "64 chars exceeds the label max");
  // single char is the minimum
  assert.equal(isDnsSafeSubdomain("a"), true);
});

test("isDnsSafeSubdomain: leading / trailing hyphen rejected; interior hyphen allowed", () => {
  assert.equal(isDnsSafeSubdomain("-acme"), false);
  assert.equal(isDnsSafeSubdomain("acme-"), false);
  assert.equal(isDnsSafeSubdomain("-"), false);
  assert.equal(isDnsSafeSubdomain("a-b"), true);
  assert.equal(isDnsSafeSubdomain("blue-bottle-co"), true);
});

test("isDnsSafeSubdomain: uppercase, underscore, dot, space, unicode all rejected", () => {
  for (const bad of ["Acme", "ACME", "a_b", "a.b", "a b", "café", "shop!", ""]) {
    assert.equal(isDnsSafeSubdomain(bad), false, `${bad} should be invalid`);
  }
});

test("parseStoreSubdomain: a 63-char label resolves; a 64-char label is rejected", () => {
  const l63 = "a".repeat(63);
  const l64 = "a".repeat(64);
  assert.equal(parseStoreSubdomain(`${l63}.ourapp.com`), l63);
  assert.equal(parseStoreSubdomain(`${l64}.ourapp.com`), null);
});

test("parseStoreSubdomain: uppercase host is normalized to the lowercase store label", () => {
  assert.equal(parseStoreSubdomain("ACME.OURAPP.COM"), "acme");
  assert.equal(parseStoreSubdomain("AcMe.ourapp.com"), "acme");
});

test("parseStoreSubdomain: :port is stripped before resolution", () => {
  assert.equal(parseStoreSubdomain("acme.ourapp.com:3000"), "acme");
  assert.equal(parseStoreSubdomain("acme.localhost:8080"), "acme");
  assert.equal(parseStoreSubdomain("ourapp.com:443"), null, "apex+port still resolves to app");
});

test("parseStoreSubdomain: multi-level host uses only the LEFTMOST label", () => {
  // `a.b.ourapp.com` → label "a.b" → leftmost "a".
  assert.equal(parseStoreSubdomain("a.b.ourapp.com"), "a");
  assert.equal(parseStoreSubdomain("shop.staging.ourapp.com"), "shop");
});

test("parseStoreSubdomain: leading-hyphen / underscore leftmost label rejected under app domain", () => {
  assert.equal(parseStoreSubdomain("-bad.ourapp.com"), null);
  assert.equal(parseStoreSubdomain("bad-.ourapp.com"), null);
  assert.equal(parseStoreSubdomain("bad_label.ourapp.com"), null);
});

test("parseStoreSubdomain: empty / null / undefined / bare label → null", () => {
  assert.equal(parseStoreSubdomain(""), null);
  assert.equal(parseStoreSubdomain(null), null);
  assert.equal(parseStoreSubdomain(undefined), null);
  assert.equal(parseStoreSubdomain("ourapp.com"), null, "apex → app");
  assert.equal(parseStoreSubdomain("localhost"), null, "bare localhost → app");
  assert.equal(parseStoreSubdomain("acme.evil.com"), null, "unrelated root → app");
});

// ─────────────────────────────── sanitizer depth ──────────────────────────────

test("HTML: <base> removed across attribute / self-closing / mixed-case / spaced variants", () => {
  const variants = [
    '<base href="https://evil.test/">',
    "<base>",
    "<base/>",
    "<base />",
    "<BASE HREF='//evil'>",
    '<BaSe   target="_blank">',
    '<base\nhref="//evil">',
  ];
  for (const v of variants) {
    const out = sanitizeInjectedHtml(`before${v}after`);
    assert.ok(!/<base/i.test(out), `base must be stripped from: ${JSON.stringify(v)}`);
    assert.ok(out.includes("before") && out.includes("after"), "surrounding markup survives");
  }
});

test("HTML: multiple <base> tags are all removed (global match)", () => {
  const out = sanitizeInjectedHtml('<base href="//a"><p>x</p><base href="//b">');
  assert.ok(!/<base/i.test(out));
  assert.ok(out.includes("<p>x</p>"));
});

test("HTML: a non-<base> tag whose name starts with 'base' is NOT over-stripped", () => {
  // The `\b` word-boundary means `<basefont>` / `<baseline>` are left alone — pin that
  // the strip is precisely `<base ...>` and not a greedy prefix match.
  const out = sanitizeInjectedHtml("<basefont color=red>");
  assert.ok(out.includes("<basefont"), "non-base tag must survive");
});

test("HTML: length-capped to exactly 20k at the boundary", () => {
  assert.equal(sanitizeInjectedHtml("a".repeat(19_999)).length, 19_999);
  assert.equal(sanitizeInjectedHtml("a".repeat(20_000)).length, 20_000);
  assert.equal(sanitizeInjectedHtml("a".repeat(20_001)).length, 20_000);
  assert.equal(sanitizeInjectedHtml("a".repeat(100_000)).length, 20_000);
});

test("HTML / fragment: null / undefined / empty input → empty string", () => {
  for (const fn of [sanitizeInjectedHtml, sanitizeHtmlFragment]) {
    assert.equal(fn(null), "");
    assert.equal(fn(undefined), "");
    assert.equal(fn(""), "");
  }
});

test("fragment: same <base> posture, keeps merchant markup", () => {
  const out = sanitizeHtmlFragment('<BASE href="//evil"/><p>hi</p>');
  assert.ok(!/<base/i.test(out));
  assert.ok(out.includes("<p>hi</p>"));
});

test("CSS: </style> and <style> breakouts stripped, mixed-case + spaced included", () => {
  for (const breakout of ["</style>", "</STYLE>", "< / style >", "<style>", "</ style"]) {
    const out = sanitizeInjectedCss(`.a{}${breakout}.b{color:red}`);
    assert.ok(!/<\s*\/?\s*style\b/i.test(out), `style breakout survived: ${breakout}`);
  }
});

test("CSS: <script> / </script> tags are stripped from the CSS channel", () => {
  const out = sanitizeInjectedCss("body{}</style><script>steal()</script>.x{}");
  assert.ok(!/<\s*\/?\s*style\b/i.test(out), "no style breakout");
  assert.ok(!/<\s*\/?\s*script\b/i.test(out), "no script tag in CSS");
});

test("CSS: length-capped to 20k; null / undefined / empty → empty string", () => {
  assert.equal(sanitizeInjectedCss("a".repeat(20_001)).length, 20_000);
  assert.equal(sanitizeInjectedCss("a".repeat(20_000)).length, 20_000);
  assert.equal(sanitizeInjectedCss(null), "");
  assert.equal(sanitizeInjectedCss(undefined), "");
  assert.equal(sanitizeInjectedCss(""), "");
});

test("JS: </script> breakout escaped to <\\/script across case / spacing variants", () => {
  for (const breakout of ["</script>", "</SCRIPT>", "< / script", "</ script >"]) {
    const out = sanitizeInjectedJs(`var s="${breakout}";`);
    assert.ok(!/<\s*\/\s*script/i.test(out), `raw close survived: ${breakout}`);
    assert.ok(out.includes("<\\/script"), `escaped form missing for: ${breakout}`);
  }
});

test("JS: an open <script (no slash) is NOT touched — only the CLOSE is the breakout", () => {
  // sanitizeInjectedJs targets `</script` specifically; a bare `<script` inside a JS
  // string is harmless (it can't close the wrapping tag). Pin that it's left intact.
  const out = sanitizeInjectedJs('var s = "<script>";');
  assert.ok(out.includes("<script>"), "open script tag is left as-is in JS channel");
});

test("JS: length-capped to 20k; null / undefined / empty → empty string", () => {
  assert.equal(sanitizeInjectedJs("a".repeat(20_001)).length, 20_000);
  assert.equal(sanitizeInjectedJs("a".repeat(20_000)).length, 20_000);
  assert.equal(sanitizeInjectedJs(null), "");
  assert.equal(sanitizeInjectedJs(undefined), "");
  assert.equal(sanitizeInjectedJs(""), "");
});

test("JS: a </script> placed AFTER the 20k cap is sliced off before escaping (cap then replace)", () => {
  // The cap is applied first, so a breakout beyond 20k is simply truncated away.
  const payload = "a".repeat(20_000) + "</script>";
  const out = sanitizeInjectedJs(payload);
  assert.equal(out.length, 20_000);
  assert.ok(!out.includes("</script"));
  assert.ok(!out.includes("<\\/script"), "the post-cap breakout is gone entirely");
});
