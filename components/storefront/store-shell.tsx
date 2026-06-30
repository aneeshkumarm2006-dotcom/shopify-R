"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { Store } from "@/types";
import { CartSheet } from "@/components/ui/cart-sheet";
import { Icon } from "@/components/ui/icon";
import { storePath, storeCurrency } from "@/lib/format";
import {
  StorefrontProvider,
  useStorefront,
  useStoreHref,
  type StorefrontCustomer,
} from "./storefront-context";
import { AgeGate } from "./age-gate";
import { STORE_HOME } from "./shared";

/**
 * Storefront shell (DESIGN §5) — the client boundary the `(store)` layout wraps every
 * storefront page in. It provides the session context (cart + age gate), renders the
 * blocking age-gate interstitial, the global cart sheet, and a dev-only "back to
 * admin" chip. Header/footer are rendered per page via the shared `StoreRenderer`
 * (home/static) or the section components directly (product/collection/checkout/…),
 * so the chrome stays consistent without living here.
 */
export function StoreShell({
  store,
  customer = null,
  navLinks = [],
  basePath,
  children,
}: {
  store: Store;
  customer?: StorefrontCustomer | null;
  navLinks?: { label: string; href: string }[];
  /** Override the tenant path prefix. Pass `""` for custom-domain requests where the
   *  visitor is at the domain root; omit to fall back to `/s/<subdomain>`. */
  basePath?: string;
  children: ReactNode;
}) {
  return (
    <StorefrontProvider
      storeId={store._id}
      storeName={store.name}
      currency={storeCurrency(store.settings)}
      ageGateEnabled={store.ageGate.enabled}
      basePath={basePath ?? storePath(store.subdomain)}
      customer={customer}
      navLinks={navLinks}
    >
      <div style={{ minHeight: "100vh", background: "var(--warm-50)", color: "var(--text)" }}>
        {children}
      </div>
      <AgeGate message={store.ageGate.message} minAge={store.ageGate.minAge} />
      <GlobalCartSheet />
      <BackToAdminChip />
    </StorefrontProvider>
  );
}

/** Cart sheet bound to the storefront context — opened from the header cart icon. */
function GlobalCartSheet() {
  const sf = useStorefront();
  const router = useRouter();
  const href = useStoreHref();
  if (!sf) return null;
  return (
    <CartSheet
      open={sf.cartOpen}
      onClose={sf.closeCart}
      currency={sf.currency}
      items={sf.cart.map((l) => ({
        id: l.key,
        title: l.title,
        variant: l.variant,
        price: l.price,
        quantity: l.quantity,
        image: l.image,
      }))}
      onQuantityChange={sf.setQuantity}
      onRemove={sf.removeLine}
      onCheckout={() => {
        sf.closeCart();
        router.push(href("/checkout"));
      }}
      onContinue={() => {
        sf.closeCart();
        router.push(href(STORE_HOME));
      }}
    />
  );
}

/**
 * Dev-only affordance: jump back to the admin app from the customer storefront. Now
 * that Stage 8 serves stores on their own subdomains, this is hidden in production —
 * a live customer storefront never shows a link back into the platform admin.
 */
function BackToAdminChip() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <a
      href="/dashboard"
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 400,
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "8px 13px",
        borderRadius: 999,
        background: "var(--warm-900)",
        color: "var(--warm-50)",
        fontSize: "var(--text-sm)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <Icon name="chevronLeft" size={15} aria-hidden />
      Back to admin
    </a>
  );
}
