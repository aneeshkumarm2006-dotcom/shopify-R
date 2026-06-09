import type { IconName } from "@/components/ui";
import type { SectionSettings, SectionType } from "@/types";

/**
 * Builder section catalog (Stage 4 · DESIGN §4.9). One place that knows the closed
 * MVP section set (PRD §6.2): its labels, tree icons, the picker's allowed types, and
 * the default settings a freshly-added section starts with. The renderer + settings
 * forms both read from this so a new section never looks broken in the live preview.
 */
export const SECTION_META: Record<SectionType, { label: string; icon: IconName }> = {
  header: { label: "Logo & navigation", icon: "layout" },
  hero: { label: "Hero", icon: "layout" },
  featured_products: { label: "Featured products", icon: "grid" },
  collection_list: { label: "Collection list", icon: "layers" },
  rich_text: { label: "Rich text", icon: "type" },
  image_with_text: { label: "Image with text", icon: "image" },
  gallery: { label: "Gallery", icon: "grid" },
  newsletter_static: { label: "Newsletter", icon: "mail" },
  custom_html: { label: "Custom HTML", icon: "code" },
  footer: { label: "Footer", icon: "list" },
};

/**
 * The ONLY section types the add-picker may offer (DESIGN §5.3 closed set). `header`
 * and `footer` are shared, always-present regions — never added or removed — so they
 * are deliberately absent here.
 */
export const ADD_SET: SectionType[] = [
  "hero",
  "featured_products",
  "collection_list",
  "rich_text",
  "image_with_text",
  "gallery",
  "newsletter_static",
  "custom_html",
];

/** Default settings for a newly added section — enough that it reads as real content. */
export function defaultSettings(type: SectionType): SectionSettings {
  switch (type) {
    case "hero":
      return {
        heading: "New hero heading",
        subtext: "Add a short, confident line of supporting copy here.",
        cta: "Shop now",
        ctaHref: "/collections/all",
        align: "left",
        height: "short",
      };
    case "featured_products":
      return { title: "Featured products", productIds: [], columns: 4 };
    case "collection_list":
      return {
        title: "Shop by category",
        columns: 4,
        collections: [
          { name: "New collection", handle: "", count: 0 },
        ],
      };
    case "rich_text":
      return {
        heading: "A heading",
        body: "Tell your story in a measured, readable column of text.",
        align: "center",
      };
    case "image_with_text":
      return {
        heading: "Image with text",
        body: "Pair an image with a short paragraph and a call to action.",
        cta: "Learn more",
        ctaHref: "",
        side: "left",
      };
    case "gallery":
      return { columns: 3, images: [] };
    case "newsletter_static":
      return {
        heading: "Stay in the loop",
        subtext: "Drops, restocks, and the occasional members-only batch.",
        placeholder: "you@email.com",
        button: "Subscribe",
      };
    case "custom_html":
      return { html: "" };
    default:
      return {};
  }
}

/** Short, collision-resistant section id for builder-created sections. */
export function newSectionId(): string {
  return `s-${Math.random().toString(36).slice(2, 8)}`;
}
