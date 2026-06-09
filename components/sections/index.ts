/**
 * Storefront "Counter" sections + the single shared `StoreRenderer` (DESIGN §5.3).
 * The live storefront (Stage 3) and the builder preview (Stage 4) both import from
 * here; there is exactly one renderer and one closed set of section components.
 */
export { StoreRenderer, type StoreRendererProps } from "./store-renderer";
export { StoreHeader } from "./store-header";
export { StoreFooter } from "./store-footer";
export { ProductCard } from "./product-card";
export { Media } from "./media";
export {
  HeroSection,
  FeaturedProductsSection,
  CollectionListSection,
  RichTextSection,
  ImageWithTextSection,
  GallerySection,
  NewsletterStaticSection,
  CustomHtmlSection,
  type SectionProps,
} from "./content-sections";
