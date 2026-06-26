import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderAbandonedCartEmail,
  renderCampaignEmail,
} from "@/lib/email/marketing-templates";

/** Marketing email renderers (Phase 5) — pure HTML/text builders. */

const store = {
  name: "Northbound",
  subdomain: "northbound",
  settings: { currency: "$", contactEmail: "shop@northbound.example" },
} as const;

test("abandoned-cart email lists items, totals them, and links to recovery", () => {
  const email = renderAbandonedCartEmail({
    store,
    cart: { items: [] },
    lines: [
      { title: "Blue Dream", quantity: 2, price: 40 },
      { title: "Gummies", quantity: 1, price: 20 },
    ],
    recoverUrl: "https://northbound.example/cart",
  });
  assert.match(email.subject, /2 items/);
  assert.ok(email.html.includes("Blue Dream"));
  assert.ok(email.html.includes("Gummies"));
  assert.ok(email.html.includes("https://northbound.example/cart"));
  // total = 2*40 + 1*20 = 100
  assert.ok(email.text.includes("100"));
});

test("singular subject for a one-item cart", () => {
  const email = renderAbandonedCartEmail({
    store,
    cart: { items: [] },
    lines: [{ title: "Solo", quantity: 1, price: 10 }],
    recoverUrl: "https://x/cart",
  });
  assert.match(email.subject, /1 item\b/);
});

test("campaign email uses the subject and splits paragraphs", () => {
  const email = renderCampaignEmail({
    store,
    subject: "Spring Sale",
    body: "First paragraph.\n\nSecond paragraph.",
  });
  assert.equal(email.subject, "Spring Sale");
  assert.ok(email.html.includes("First paragraph."));
  assert.ok(email.html.includes("Second paragraph."));
  assert.equal((email.html.match(/<p /g) ?? []).length, 2);
});

test("campaign falls back to a default subject and escapes HTML in the body", () => {
  const email = renderCampaignEmail({
    store,
    subject: "",
    body: "Hello <script>alert(1)</script>",
  });
  assert.match(email.subject, /News from Northbound/);
  assert.ok(!email.html.includes("<script>"));
  assert.ok(email.html.includes("&lt;script&gt;"));
});
