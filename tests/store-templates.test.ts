import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORE_TEMPLATES,
  buildTemplateConfig,
  isStoreTemplateId,
  type StoreTemplateConfig,
  type StoreTemplateId,
} from "../lib/data/store-templates";
import type { Template } from "../types";

/**
 * Starter-template integrity tests (PRD §6.1 onboarding · §5.3 themeConfig).
 *
 * A template is a pre-built themeConfig the builder and StoreRenderer consume
 * as-is, so a malformed preset would break a brand-new store on its very first
 * render. These tests pin the structural contract: every pickable template
 * materialises, every section is from the closed MVP set, and every
 * `sectionOrder` entry resolves to a real section (and vice versa).
 */

/** The closed MVP section set the builder can add/edit (PRD §6.2). */
const ADDABLE = new Set([
  "hero",
  "featured_products",
  "collection_list",
  "rich_text",
  "image_with_text",
  "gallery",
  "newsletter_static",
  "custom_html",
]);

const TEMPLATE_KEYS = ["home", "product", "collection", "page", "cart"] as const;

function mustBuild(id: StoreTemplateId): StoreTemplateConfig {
  const built = buildTemplateConfig(id);
  assert.ok(built, `${id} must materialise a config`);
  return built;
}

test("exactly three pickable templates are offered", () => {
  assert.equal(STORE_TEMPLATES.length, 3);
  const ids = STORE_TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, 3, "template ids must be unique");
  for (const t of STORE_TEMPLATES) {
    assert.ok(t.name && t.description && t.badge, `${t.id} needs full card metadata`);
  }
});

test("the id guard accepts every template plus blank, rejects junk", () => {
  for (const t of STORE_TEMPLATES) assert.equal(isStoreTemplateId(t.id), true);
  assert.equal(isStoreTemplateId("blank"), true);
  for (const bad of ["", "shopify", null, undefined, 7, "SMOKE-VAPE"]) {
    assert.equal(isStoreTemplateId(bad), false, `${String(bad)} must be rejected`);
  }
});

test("blank (and unknown ids) build no config — the empty store is kept", () => {
  assert.equal(buildTemplateConfig("blank"), null);
});

for (const meta of STORE_TEMPLATES) {
  test(`${meta.id}: builds a structurally sound themeConfig`, () => {
    const config: StoreTemplateConfig = mustBuild(meta.id);

    // Shared chrome is present and correctly typed.
    assert.equal(config.header.type, "header");
    assert.equal(config.footer.type, "footer");

    // All five page templates exist (renderer indexes them unconditionally).
    for (const key of TEMPLATE_KEYS) {
      const tpl: Template = config.templates[key];
      assert.ok(tpl, `${meta.id}.${key} template missing`);

      const orderIds: string[] = tpl.sectionOrder;
      const mapIds: string[] = Object.keys(tpl.sections);
      assert.deepEqual(
        [...orderIds].sort(),
        [...mapIds].sort(),
        `${meta.id}.${key}: sectionOrder and sections map must agree`,
      );
      assert.equal(new Set(orderIds).size, orderIds.length, `${meta.id}.${key}: duplicate ids`);

      for (const id of orderIds) {
        const s = tpl.sections[id];
        assert.ok(s, `${meta.id}.${key}.${id}: section missing from map`);
        assert.equal(s.id, id, `${meta.id}.${key}.${id}: section id must match its key`);
        assert.ok(ADDABLE.has(s.type), `${meta.id}.${key}.${id}: ${s.type} not in MVP set`);
        assert.equal(typeof s.settings, "object");
        assert.ok(Array.isArray(s.blockOrder));
        assert.equal(typeof s.blocks, "object");

        // A starter store has no products yet — product-bearing sections must
        // not reference phantom ids the storefront would fail to resolve.
        if (s.type === "featured_products") {
          assert.deepEqual(s.settings.productIds, [], `${meta.id}: seeded productIds must be empty`);
        }
      }
    }

    // The promise of the picker: a built-out home page and an About page.
    assert.ok(config.templates.home.sectionOrder.length >= 4, `${meta.id}: home too thin`);
    assert.ok(config.templates.page.sectionOrder.length >= 1, `${meta.id}: about page missing`);
  });
}

test("each call returns a fresh object — presets can never be mutated shared state", () => {
  const a: StoreTemplateConfig = mustBuild("smoke-vape");
  const b: StoreTemplateConfig = mustBuild("smoke-vape");
  assert.notEqual(a, b);
  assert.notEqual(a.templates.home, b.templates.home);
  a.templates.home.sectionOrder.push("s-tampered");
  assert.ok(!b.templates.home.sectionOrder.includes("s-tampered"));
});

test("the three templates are genuinely different layouts", () => {
  const homes = STORE_TEMPLATES.map((meta) => {
    const config: StoreTemplateConfig = mustBuild(meta.id);
    return config.templates.home.sectionOrder
      .map((id) => {
        const s = config.templates.home.sections[id];
        assert.ok(s, `${meta.id}: ${id} missing from home sections`);
        return s.type;
      })
      .join(">");
  });
  assert.equal(new Set(homes).size, homes.length, "home section stacks must differ");
});
