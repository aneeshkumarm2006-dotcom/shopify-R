import { cache } from "react";
import { headers } from "next/headers";
import type { Store } from "@/types";
import { getStore, getStoreBySubdomain } from "@/lib/data/store";
import { MOCK_STORE_ID } from "@/lib/data/mocks";
import { STORE_SUBDOMAIN_HEADER } from "./host";

/**
 * Storefront tenant resolution (Stage 8, PRD §2.2). The middleware stamps the
 * resolved subdomain onto the request; here we read it (server-only) and load the
 * store, enforcing **live-only serving**: a `draft` or `suspended` store does not
 * serve a storefront (PRD §11 single-config model) — callers `notFound()` on `null`.
 *
 * With no subdomain header (a direct hit to the dev `/preview` home on bare
 * `localhost`, where there is no tenant subdomain) we fall back to the demo tenant so
 * Part A keeps rendering with zero infrastructure. In production that demo id simply
 * isn't in the DB, so the fallback naturally 404s rather than leaking a store.
 *
 * Wrapped in React `cache()` so the `(store)` layout, each page, and their
 * `generateMetadata` share a single resolution per request.
 */
export const resolveStorefront = cache(async (): Promise<Store | null> => {
  const subdomain = (await headers()).get(STORE_SUBDOMAIN_HEADER);
  const store = subdomain
    ? await getStoreBySubdomain(subdomain)
    : await getStore(MOCK_STORE_ID); // dev fallback (no subdomain on bare localhost)

  if (!store) return null;
  if (store.status !== "live") return null; // draft / suspended don't serve
  return store;
});
