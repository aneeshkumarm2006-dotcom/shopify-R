import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeInjectedHtml,
  sanitizeInjectedCss,
  sanitizeInjectedJs,
  sanitizeHtmlFragment,
  sanitizeCodeInjection,
} from "../lib/sanitize/inject";

/**
 * Code-injection sanitizer tests (Stage 14 / PRD §9).
 *
 * Scripts are intentionally allowed (merchants add analytics/pixels), so these tests
 * pin the *platform-affecting* cases the sanitizer must still neutralize: `<base>`
 * navigation hijacks, `</style>` / `<script>` breakouts out of the CSS channel, the
 * `</script>` breakout out of the JS channel, and the per-field length caps.
 */

test("HTML: <base> tag is stripped (navigation-hijack primitive)", () => {
  const out = sanitizeInjectedHtml('<base href="https://evil.test/"><script>ok()</script>');
  assert.ok(!/<base/i.test(out), "base tag must be removed");
  assert.ok(/<script>ok\(\)<\/script>/.test(out), "legit script must survive");
});

test("HTML: length-capped to 20k", () => {
  const out = sanitizeInjectedHtml("a".repeat(50_000));
  assert.equal(out.length, 20_000);
});

test("HTML: empty / nullish input yields empty string", () => {
  assert.equal(sanitizeInjectedHtml(null), "");
  assert.equal(sanitizeInjectedHtml(undefined), "");
  assert.equal(sanitizeInjectedHtml(""), "");
});

test("CSS: </style> and <script> breakouts are stripped", () => {
  const out = sanitizeInjectedCss("body{}</style><script>steal()</script>.x{color:red}");
  assert.ok(!/<\s*\/?\s*style/i.test(out), "no style breakout");
  assert.ok(!/<\s*\/?\s*script/i.test(out), "no script tag in CSS");
});

test("JS: </script> breakout is escaped, not left intact", () => {
  const out = sanitizeInjectedJs('var s = "</script><img src=x onerror=alert(1)>";');
  assert.ok(!/<\/script/i.test(out), "raw </script must not survive");
  assert.ok(out.includes("<\\/script"), "it should be escaped to <\\/script");
});

test("custom_html fragment: same <base> posture as injected HTML", () => {
  const out = sanitizeHtmlFragment('<base href="//evil"><p>hi</p>');
  assert.ok(!/<base/i.test(out));
  assert.ok(out.includes("<p>hi</p>"));
});

test("sanitizeCodeInjection bundles all four channels", () => {
  const out = sanitizeCodeInjection({
    headHtml: "<base><meta>",
    bodyHtml: "<div>x</div>",
    customCss: ".a{}</style>",
    customJs: 'a("</script>")',
  });
  assert.ok(!/<base/i.test(out.headHtml));
  assert.ok(out.bodyHtml.includes("<div>x</div>"));
  assert.ok(!/<\/style/i.test(out.customCss));
  assert.ok(!/<\/script/i.test(out.customJs));
});
