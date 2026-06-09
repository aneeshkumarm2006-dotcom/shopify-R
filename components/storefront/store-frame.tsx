import type { ReactNode } from "react";
import type { ThemeConfig } from "@/types";
import { StoreHeader } from "@/components/sections/store-header";
import { StoreFooter } from "@/components/sections/store-footer";

/**
 * Chrome wrapper for the bespoke storefront pages (product, collection, cart,
 * checkout, confirmation) — renders the shared header, the page body, and an
 * optional footer from the same `themeConfig` the `StoreRenderer` uses. Checkout and
 * confirmation pass `footer={false}` for a calmer, focused flow (matches the
 * prototype). Home and static pages don't use this — they go through `StoreRenderer`
 * with chrome on.
 */
export function StoreFrame({
  config,
  storeName,
  footer = true,
  children,
}: {
  config: ThemeConfig;
  storeName?: string;
  footer?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <StoreHeader section={config.header} />
      <main>{children}</main>
      {footer && <StoreFooter section={config.footer} storeName={storeName} />}
    </>
  );
}
