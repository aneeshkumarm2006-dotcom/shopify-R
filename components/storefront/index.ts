/**
 * Storefront ("Counter" theme) composite views + session shell (DESIGN §5).
 * Sections + the shared renderer live in `@/components/sections`; this module holds
 * the page-level views and the client shell that the `(store)` layout wraps.
 */
export { StoreShell } from "./store-shell";
export { StoreFrame } from "./store-frame";
export { StoreLogo } from "./store-logo";
export { AgeGate } from "./age-gate";
export { ProductView } from "./product-view";
export { CollectionView } from "./collection-view";
export { SearchView } from "./search-view";
export { ProductGrid } from "./product-grid";
export { CartPage } from "./cart-page";
export { CheckoutView } from "./checkout-view";
export { ConfirmationView } from "./confirmation-view";
export {
  StorefrontProvider,
  useStorefront,
  type CartLineState,
} from "./storefront-context";
export { STORE_HOME } from "./shared";
