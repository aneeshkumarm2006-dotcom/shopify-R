import { notFound } from "next/navigation";
import { resolveStorefront } from "@/lib/tenant/resolve";
import { getCurrentCustomer } from "@/lib/customer/session";
import { getCollections } from "@/lib/data";
import { StoreShell } from "@/components/storefront";
import { TrackPageview } from "@/components/storefront/track-pageview";
import {
  StoreInjectionBody,
  StoreInjectionHead,
} from "@/components/storefront/store-code-injection";

/**
 * Storefront ("Counter") route-group layout (DESIGN §5). It resolves the current
 * tenant from the request subdomain (Stage 8) and wraps every storefront page in the
 * client `StoreShell`, which provides the session context (cart + age gate), the
 * blocking age-gate interstitial, and the global cart sheet. Header/footer are
 * rendered per page via the shared `StoreRenderer` (home/static) or `StoreFrame`
 * (product/collection/cart/checkout).
 *
 * `resolveStorefront()` enforces live-only serving: a `draft` or `suspended` store
 * (or an unknown subdomain) `notFound()`s here, so the whole group is gated in one
 * place. On bare `localhost` (no tenant subdomain) it falls back to the demo store so
 * the dev `/preview` home keeps rendering.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const store = await resolveStorefront();
  if (!store) notFound();

  // Resolve the signed-in shopper (Phase 3) so the shell can personalize chrome and
  // key the cart to their account. Anonymous → null, exactly as before.
  const customer = await getCurrentCustomer(store);

  // Storefront nav (real-feel): always give the header a menu built from the store's
  // collections, so a store with no hand-configured nav still browses like a real shop.
  const collections = await getCollections(store._id);
  const navLinks = collections
    .slice(0, 5)
    .map((c) => ({ label: c.title, href: `/collections/${c.handle}` }));

  // Global code injection (PRD §6.3) — sanitized, storefront-only. Head bundle
  // (custom CSS + head HTML) wraps before the shell; body bundle (body HTML +
  // custom JS) renders after it, at the end of the storefront document.
  return (
    <>
      <StoreInjectionHead injection={store.codeInjection} />
      {store.subdomain && <TrackPageview subdomain={store.subdomain} />}
      <StoreShell
        store={store}
        navLinks={navLinks}
        customer={
          customer
            ? { id: customer._id, email: customer.email, name: customer.name }
            : null
        }
      >
        {children}
      </StoreShell>
      <StoreInjectionBody injection={store.codeInjection} />
    </>
  );
}
