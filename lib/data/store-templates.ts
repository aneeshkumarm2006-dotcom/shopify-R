import type { Section, Template, TemplateKey } from "@/types";

/**
 * Starter store templates (PRD §6.1 onboarding, §5.3 themeConfig).
 *
 * When a merchant finishes onboarding they pick one of three vertical-specific
 * starting points — Smoke & Vape, CBD & Wellness, or Dispensary — or start from
 * scratch. A template is nothing more than a pre-built `themeConfig` (the same
 * shape the builder edits and `saveThemeConfig` persists): header/footer chrome,
 * a fully-sectioned home page, and an About page, with copy and category names
 * tuned to the vertical. Picking one never locks anything in — the merchant lands
 * in the builder with ordinary sections they can edit, reorder, or delete.
 *
 * CLIENT-SAFE: no DB imports. The onboarding picker reads the metadata; only the
 * server action calls `buildTemplateConfig` and persists the result.
 *
 * Collection handles (`/collections/devices`, …) follow the same convention as
 * the demo store: the storefront resolves them once the merchant creates
 * collections with matching handles — the template seeds a consistent set of
 * names so nav, tiles, and CTAs all line up from day one.
 */

export type StoreTemplateId = "smoke-vape" | "cbd-wellness" | "dispensary" | "blank";

/** The slice of themeConfig a template provides (`storeId`/timestamps are server-owned). */
export interface StoreTemplateConfig {
  templates: Record<TemplateKey, Template>;
  header: Section;
  footer: Section;
}

export interface StoreTemplateMeta {
  id: StoreTemplateId;
  name: string;
  /** One line under the card title — what the layout leads with. */
  description: string;
  /** Micro-label on the card, e.g. the vertical it serves. */
  badge: string;
}

/** The three pickable starting points, in display order (`blank` is offered separately). */
export const STORE_TEMPLATES: StoreTemplateMeta[] = [
  {
    id: "smoke-vape",
    name: "Smoke & Vape",
    description: "Bold, dark storefront that leads with drops and hardware categories.",
    badge: "Vape · 21+",
  },
  {
    id: "cbd-wellness",
    name: "CBD & Wellness",
    description: "Calm, trust-first layout that leads with lab results and your story.",
    badge: "CBD · Wellness",
  },
  {
    id: "dispensary",
    name: "Dispensary",
    description: "Menu-first catalog layout built around categories and staff picks.",
    badge: "Cannabis · 21+",
  },
];

export function isStoreTemplateId(value: unknown): value is StoreTemplateId {
  return value === "blank" || STORE_TEMPLATES.some((t) => t.id === value);
}

/* ------------------------------------------------------------------ helpers */

function section(id: string, type: Section["type"], settings: Record<string, unknown>): Section {
  return { id, type, settings, blockOrder: [], blocks: {} };
}

function homeTemplate(sections: Section[]): Template {
  return {
    sectionOrder: sections.map((s) => s.id),
    sections: Object.fromEntries(sections.map((s) => [s.id, s])),
  };
}

/** Shared skeleton: a built home + About page; product/collection/cart use renderer defaults. */
function config(home: Section[], about: Section, header: Section, footer: Section): StoreTemplateConfig {
  return {
    header,
    footer,
    templates: {
      home: homeTemplate(home),
      product: { sectionOrder: [], sections: {} },
      collection: { sectionOrder: [], sections: {} },
      page: { sectionOrder: [about.id], sections: { [about.id]: about } },
      cart: { sectionOrder: [], sections: {} },
    },
  };
}

/* --------------------------------------------------------- 1 · Smoke & Vape */

function smokeVape(): StoreTemplateConfig {
  const header = section("header", "header", {
    promo: "Free shipping on orders over $50 — 21+ only",
    showSearch: true,
    showCart: true,
    nav: [
      { label: "Devices", href: "/collections/devices" },
      { label: "E-Liquids", href: "/collections/e-liquids" },
      { label: "Pods & Coils", href: "/collections/pods-coils" },
      { label: "Accessories", href: "/collections/accessories" },
    ],
  });

  const footer = section("footer", "footer", {
    tagline: "Authentic hardware and small-batch e-liquid, shipped fast.",
    columns: [
      {
        title: "Shop",
        links: [
          { label: "Devices", href: "/collections/devices" },
          { label: "E-Liquids", href: "/collections/e-liquids" },
          { label: "Accessories", href: "/collections/accessories" },
        ],
      },
      {
        title: "Support",
        links: [
          { label: "Shipping", href: "/pages/shipping" },
          { label: "Returns & warranty", href: "/pages/returns" },
          { label: "Contact", href: "/pages/contact" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About us", href: "/pages/about" },
          { label: "Authenticity", href: "/pages/authenticity" },
        ],
      },
    ],
    legal:
      "WARNING: This product contains nicotine. Nicotine is an addictive chemical. Sales restricted to adults 21 and over.",
  });

  const home = [
    section("s-hero", "hero", {
      badge: "21+ · Age verified at checkout",
      heading: "Hardware that\nhits different",
      subtext:
        "Curated devices, fresh coils, and small-batch e-liquid — every unit sourced direct and checked for authenticity before it ships.",
      cta: "Shop devices",
      ctaHref: "/collections/devices",
      align: "left",
      height: "tall",
    }),
    section("s-drops", "featured_products", {
      title: "Fresh drops",
      productIds: [],
      columns: 4,
    }),
    section("s-lineup", "collection_list", {
      title: "Shop the lineup",
      columns: 4,
      collections: [
        { name: "Devices", handle: "devices" },
        { name: "E-Liquids", handle: "e-liquids" },
        { name: "Pods & Coils", handle: "pods-coils" },
        { name: "Accessories", handle: "accessories" },
      ],
    }),
    section("s-authentic", "image_with_text", {
      heading: "100% authentic, zero clones",
      body: "Every device we stock comes direct from the manufacturer or an authorized distributor — scratch-and-check codes intact. If it's on the shelf, it's the real thing, covered by the full factory warranty.",
      cta: "How we source",
      ctaHref: "/pages/authenticity",
      side: "right",
    }),
    section("s-news", "newsletter_static", {
      heading: "Restocks & drop alerts",
      subtext: "New hardware, limited e-liquid runs, and back-in-stock pings. No spam.",
      placeholder: "you@email.com",
      button: "Subscribe",
    }),
  ];

  const about = section("s-page-about", "rich_text", {
    heading: "About us",
    body: "We started as collectors who were tired of clone hardware and dusty stock. Today we run a tight catalog of gear we actually use — sourced direct, stored right, and shipped the same day you order.",
  });

  return config(home, about, header, footer);
}

/* ------------------------------------------------------- 2 · CBD & Wellness */

function cbdWellness(): StoreTemplateConfig {
  const header = section("header", "header", {
    promo: "Third-party lab tested — free shipping over $40",
    showSearch: true,
    showCart: true,
    nav: [
      { label: "Tinctures", href: "/collections/tinctures" },
      { label: "Gummies", href: "/collections/gummies" },
      { label: "Topicals", href: "/collections/topicals" },
      { label: "Bundles", href: "/collections/bundles" },
    ],
  });

  const footer = section("footer", "footer", {
    tagline: "Full-spectrum CBD, grown with intention and verified by independent labs.",
    columns: [
      {
        title: "Shop",
        links: [
          { label: "Tinctures", href: "/collections/tinctures" },
          { label: "Gummies", href: "/collections/gummies" },
          { label: "Topicals", href: "/collections/topicals" },
        ],
      },
      {
        title: "Learn",
        links: [
          { label: "Lab results", href: "/pages/lab-results" },
          { label: "Dosage guide", href: "/pages/dosage" },
          { label: "Our story", href: "/pages/about" },
        ],
      },
      {
        title: "Support",
        links: [
          { label: "Shipping", href: "/pages/shipping" },
          { label: "Contact", href: "/pages/contact" },
        ],
      },
    ],
    legal:
      "These statements have not been evaluated by the Food and Drug Administration. These products are not intended to diagnose, treat, cure, or prevent any disease. For adults 21+.",
  });

  const home = [
    section("s-hero", "hero", {
      badge: "Lab tested · Full spectrum",
      heading: "Calm,\nbottled",
      subtext:
        "Full-spectrum tinctures, gummies, and topicals made from organically grown hemp — with a published lab report behind every batch.",
      cta: "Shop bestsellers",
      ctaHref: "/collections/bundles",
      align: "center",
      height: "short",
    }),
    section("s-verify", "rich_text", {
      heading: "Wellness you can verify",
      body: "Every batch we sell is tested by an independent, ISO-accredited lab for potency, pesticides, and heavy metals — and every certificate of analysis is published, not promised. Scan the QR on your bottle and read the numbers yourself.",
      align: "center",
    }),
    section("s-formats", "collection_list", {
      title: "Find your format",
      columns: 4,
      collections: [
        { name: "Tinctures", handle: "tinctures" },
        { name: "Gummies", handle: "gummies" },
        { name: "Topicals", handle: "topicals" },
        { name: "Pets", handle: "pets" },
      ],
    }),
    section("s-soil", "image_with_text", {
      heading: "From soil to shelf",
      body: "Our hemp is grown on family farms we visit every season, extracted in small batches, and bottled within weeks of harvest. Nothing sits in a warehouse losing potency — freshness is the quiet ingredient.",
      cta: "Read our story",
      ctaHref: "/pages/about",
      side: "left",
    }),
    section("s-news", "newsletter_static", {
      heading: "Join the ritual",
      subtext: "Honest wellness notes, new-batch drops, and subscriber-only pricing. Once a week, no noise.",
      placeholder: "you@email.com",
      button: "Subscribe",
    }),
  ];

  const about = section("s-page-about", "rich_text", {
    heading: "Our story",
    body: "We got into CBD for the same reason most of our customers did — looking for something that works without the fog. What started as a kitchen-table experiment is now a small team obsessed with sourcing, testing, and transparency.",
  });

  return config(home, about, header, footer);
}

/* ----------------------------------------------------------- 3 · Dispensary */

function dispensary(): StoreTemplateConfig {
  const header = section("header", "header", {
    promo: "Order by 4 pm for same-day local delivery",
    showSearch: true,
    showCart: true,
    nav: [
      { label: "Flower", href: "/collections/flower" },
      { label: "Pre-Rolls", href: "/collections/pre-rolls" },
      { label: "Edibles", href: "/collections/edibles" },
      { label: "Concentrates", href: "/collections/concentrates" },
    ],
  });

  const footer = section("footer", "footer", {
    tagline: "A rotating menu of small-farm flower, fresh pre-rolls, and house favorites.",
    columns: [
      {
        title: "Menu",
        links: [
          { label: "Flower", href: "/collections/flower" },
          { label: "Pre-Rolls", href: "/collections/pre-rolls" },
          { label: "Edibles", href: "/collections/edibles" },
          { label: "Concentrates", href: "/collections/concentrates" },
        ],
      },
      {
        title: "Visit",
        links: [
          { label: "About us", href: "/pages/about" },
          { label: "Our growers", href: "/pages/growers" },
        ],
      },
      {
        title: "Support",
        links: [
          { label: "Delivery zones", href: "/pages/delivery" },
          { label: "Contact", href: "/pages/contact" },
        ],
      },
    ],
    legal:
      "For use only by adults 21 and older. Keep out of reach of children. Do not operate a vehicle or machinery under the influence.",
  });

  const home = [
    section("s-hero", "hero", {
      badge: "Licensed retailer · 21+",
      heading: "Today's menu,\ncurated daily",
      subtext:
        "Small-farm flower, fresh pre-rolls, and a rotating shelf of staff favorites — updated every morning, delivered the same day.",
      cta: "Browse the menu",
      ctaHref: "/collections/flower",
      align: "left",
      height: "short",
    }),
    section("s-menu", "collection_list", {
      title: "Shop the menu",
      columns: 4,
      collections: [
        { name: "Flower", handle: "flower" },
        { name: "Pre-Rolls", handle: "pre-rolls" },
        { name: "Edibles", handle: "edibles" },
        { name: "Concentrates", handle: "concentrates" },
      ],
    }),
    section("s-picks", "featured_products", {
      title: "Staff picks",
      productIds: [],
      columns: 4,
    }),
    section("s-growers", "image_with_text", {
      heading: "Know your grower",
      body: "Every jar on our shelf names the farm it came from. We buy direct from cultivators we've walked the rows with, so you always know who grew it, how, and when it was harvested.",
      cta: "Meet the farms",
      ctaHref: "/pages/growers",
      side: "right",
    }),
    section("s-gallery", "gallery", {
      columns: 3,
      images: [],
    }),
    section("s-news", "newsletter_static", {
      heading: "Menu drops & deals",
      subtext: "First look at the morning menu, restock alerts, and member-only pricing.",
      placeholder: "you@email.com",
      button: "Subscribe",
    }),
  ];

  const about = section("s-page-about", "rich_text", {
    heading: "About the shop",
    body: "We're a neighborhood dispensary with a simple rule: nothing goes on the menu we wouldn't take home ourselves. Small farms, honest pricing, and budtenders who remember your last order.",
  });

  return config(home, about, header, footer);
}

/* ------------------------------------------------------------------ exports */

/**
 * Materialise a template's themeConfig. Returns `null` for `blank` (and anything
 * unrecognised) — the caller keeps the empty config seeded at provisioning.
 * Built fresh per call so a caller can never mutate a shared preset object.
 */
export function buildTemplateConfig(id: StoreTemplateId): StoreTemplateConfig | null {
  switch (id) {
    case "smoke-vape":
      return smokeVape();
    case "cbd-wellness":
      return cbdWellness();
    case "dispensary":
      return dispensary();
    default:
      return null;
  }
}
