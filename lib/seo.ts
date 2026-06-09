import type { Metadata } from "next";
import type { Store } from "@/types";

/**
 * Per-page storefront SEO (Stage 11, PRD §6.3). Every storefront page resolves its
 * `<head>` metadata through here so the precedence is consistent:
 *
 *   page override  →  store SEO default  →  store name / empty
 *
 * The merchant sets store-wide defaults in Settings (`store.seoDefaults`); product
 * pages layer their per-product overrides (`product.seo`) on top; the OG image falls
 * back through page → store default. Open Graph + Twitter Card tags are emitted so
 * shared links render a card. Next composes these into the document `<head>` for the
 * SSR'd storefront.
 */
export interface PageSeo {
  title?: string;
  description?: string;
  ogImage?: string;
}

export function buildStoreMetadata(store: Store, page: PageSeo = {}): Metadata {
  const title = page.title || store.seoDefaults.title || store.name;
  const description = page.description || store.seoDefaults.description || "";
  const ogImage = page.ogImage || store.seoDefaults.ogImage;
  const images = ogImage ? [ogImage] : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: store.name,
      type: "website",
      images,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images,
    },
  };
}
