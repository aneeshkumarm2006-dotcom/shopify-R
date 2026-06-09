import type { Section, ThemeConfig } from "@/types";
import { MOCK_STORE_ID } from "./store";

const NOW = "2026-06-08T00:00:00.000Z";
const CREATED = "2026-03-02T00:00:00.000Z";

/**
 * Helper: a section with no blocks (the closed MVP section set is mostly
 * settings-driven; blocks are used sparingly, e.g. footer columns / gallery).
 */
function section(id: string, type: Section["type"], settings: Record<string, unknown>): Section {
  return { id, type, settings, blockOrder: [], blocks: {} };
}

/* ---- Shared header / footer (PRD §5.3 — live across templates) ---- */
const header = section("header", "header", {
  promo: "Free local delivery on orders over $75",
  showSearch: true,
  showCart: true,
  nav: [
    { label: "Flower", href: "/collections/flower" },
    { label: "Concentrates", href: "/collections/concentrates" },
    { label: "Edibles", href: "/collections/edibles" },
    { label: "Wellness", href: "/collections/wellness" },
  ],
});

const footer = section("footer", "footer", {
  tagline: "Small-batch flower, solventless extracts, and considered wellness.",
  columns: [
    { title: "Shop", links: [{ label: "Flower", href: "/collections/flower" }, { label: "Edibles", href: "/collections/edibles" }] },
    { title: "About", links: [{ label: "Our process", href: "/pages/process" }, { label: "Lab results", href: "/pages/lab" }] },
    { title: "Support", links: [{ label: "Contact", href: "/pages/contact" }, { label: "Shipping", href: "/pages/shipping" }] },
  ],
  legal: "21+ only. Keep out of reach of children. For use only by adults.",
});

/* ---- Home template sections (seeded from prototype HOME_CONFIG) ---- */
const sHero = section("s-hero", "hero", {
  heading: "Cultivated for\nthe curious",
  subtext:
    "Small-batch flower, solventless extracts, and considered wellness — sourced and delivered with care across Oregon.",
  cta: "Shop the collection",
  ctaHref: "/collections/flower",
  align: "left",
  height: "tall",
});
const sFeatured = section("s-feat", "featured_products", {
  title: "New this week",
  productIds: ["p1", "p4", "p5", "p7"],
  columns: 4,
});
const sImageText = section("s-iwt", "image_with_text", {
  heading: "Grown the slow way",
  body: "Every harvest is hang-dried, hand-trimmed, and cured for a minimum of three weeks. No shortcuts, no irradiation — just flower that tastes the way it was meant to.",
  cta: "Our process",
  ctaHref: "/pages/process",
  side: "left",
});
const sCollections = section("s-coll", "collection_list", {
  title: "Shop by category",
  columns: 4,
  collections: [
    { name: "Flower", handle: "flower", count: 4 },
    { name: "Concentrates", handle: "concentrates", count: 1 },
    { name: "Edibles", handle: "edibles", count: 1 },
    { name: "Wellness", handle: "wellness", count: 2 },
  ],
});
const sNewsletter = section("s-news", "newsletter_static", {
  heading: "First to know",
  subtext: "Drops, restocks, and the occasional members-only batch. No noise.",
  placeholder: "you@email.com",
  button: "Subscribe",
});

/**
 * The demo store's full themeConfig (PRD §5.3). The home template is fully built
 * out; product/collection/page/cart carry sensible defaults the renderer can use.
 * This is the object the storefront `StoreRenderer` (Stage 3) and builder (Stage 4)
 * both consume — there is one renderer, not two.
 */
export const HOME_CONFIG: ThemeConfig = {
  storeId: MOCK_STORE_ID,
  header,
  footer,
  templates: {
    home: {
      sectionOrder: [sHero.id, sFeatured.id, sImageText.id, sCollections.id, sNewsletter.id],
      sections: {
        [sHero.id]: sHero,
        [sFeatured.id]: sFeatured,
        [sImageText.id]: sImageText,
        [sCollections.id]: sCollections,
        [sNewsletter.id]: sNewsletter,
      },
    },
    product: { sectionOrder: [], sections: {} },
    collection: { sectionOrder: [], sections: {} },
    page: {
      sectionOrder: ["s-page-rt"],
      sections: {
        "s-page-rt": section("s-page-rt", "rich_text", {
          heading: "About Northbound",
          body: "We're a small Oregon team obsessed with doing things the slow, careful way.",
        }),
      },
    },
    cart: { sectionOrder: [], sections: {} },
  },
  createdAt: CREATED,
  updatedAt: NOW,
};
