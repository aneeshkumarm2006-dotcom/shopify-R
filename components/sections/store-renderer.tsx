"use client";

import type { ComponentType } from "react";
import type { Product, SectionType, TemplateKey, ThemeConfig } from "@/types";
import { StoreHeader } from "./store-header";
import { StoreFooter } from "./store-footer";
import {
  CollectionListSection,
  CustomHtmlSection,
  FeaturedProductsSection,
  GallerySection,
  HeroSection,
  ImageWithTextSection,
  NewsletterStaticSection,
  RichTextSection,
  type SectionProps,
} from "./content-sections";

/**
 * `StoreRenderer` — the ONE renderer (DESIGN §5.3). It takes `(storeId, themeConfig,
 * mode)` and renders `header → template sections → footer` from config. The live
 * storefront and the Stage 4 builder preview both use this exact component — do not
 * fork. `mode: "preview"` makes sections inert and selectable (the builder wires
 * `selectedSectionId` / `onSelectSection` to its structure tree).
 *
 * Product-bearing sections resolve against the `products` prop (no async inside), so
 * the builder can re-render live from local React state as settings change.
 */
const SECTION_COMPONENTS: Partial<Record<SectionType, ComponentType<SectionProps>>> = {
  hero: HeroSection,
  featured_products: FeaturedProductsSection,
  collection_list: CollectionListSection,
  rich_text: RichTextSection,
  image_with_text: ImageWithTextSection,
  gallery: GallerySection,
  newsletter_static: NewsletterStaticSection,
  custom_html: CustomHtmlSection,
};

export interface StoreRendererProps {
  storeId: string;
  config: ThemeConfig;
  /** Which template's body sections to render (default `home`). */
  template?: TemplateKey;
  mode?: "live" | "preview";
  /** Resolved store products for `featured_products` / product-bearing sections. */
  products?: Product[];
  currency?: string;
  storeName?: string;
  /** Render the shared header + footer around the sections (default true). */
  chrome?: boolean;
  // --- builder preview hooks (Stage 4) ---
  selectedSectionId?: string | null;
  onSelectSection?: (id: string) => void;
}

export function StoreRenderer({
  storeId,
  config,
  template = "home",
  mode = "live",
  products = [],
  currency = "$",
  storeName,
  chrome = true,
  selectedSectionId,
  onSelectSection,
}: StoreRendererProps) {
  const preview = mode === "preview";
  const tpl = config.templates[template];
  const order = tpl?.sectionOrder ?? [];

  /**
   * In preview (builder) mode every region — header, each template section, footer —
   * is wrapped in a selectable affordance: a click selects it and the active one shows
   * a lime outline. In live mode `preview` is false and we render the node untouched,
   * so the storefront keeps its native layout (e.g. the header's `position: sticky`,
   * which an always-present wrapper div would defeat). One renderer, no fork.
   */
  const selectable = (id: string, node: React.ReactNode) => {
    const selected = selectedSectionId === id;
    return (
      <div
        key={id}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={(e) => {
          e.stopPropagation();
          onSelectSection?.(id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectSection?.(id);
          }
        }}
        style={{
          position: "relative",
          cursor: "pointer",
          outline: selected ? "2px solid var(--lime-500)" : undefined,
          outlineOffset: -2,
        }}
      >
        {node}
      </div>
    );
  };

  const header = <StoreHeader section={config.header} preview={preview} />;
  const footer = (
    <StoreFooter section={config.footer} preview={preview} storeName={storeName} />
  );

  return (
    <div data-store-id={storeId}>
      {chrome && (preview ? selectable("header", header) : header)}
      <main>
        {order.map((id) => {
          const section = tpl.sections[id];
          if (!section) return null;
          const Component = SECTION_COMPONENTS[section.type];
          if (!Component) return null;
          const node = (
            <Component
              section={section}
              products={products}
              currency={currency}
              preview={preview}
            />
          );
          return preview ? selectable(id, node) : <div key={id}>{node}</div>;
        })}
      </main>
      {chrome && (preview ? selectable("footer", footer) : footer)}
    </div>
  );
}
