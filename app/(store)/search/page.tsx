import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductFacets, getThemeConfig, searchProducts } from "@/lib/data";
import type { ProductSort } from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";
import { buildStoreMetadata } from "@/lib/seo";
import { SearchView, StoreFrame } from "@/components/storefront";

/**
 * Storefront search page (DESIGN §5.4). Resolves the tenant by subdomain (Stage 8),
 * reads the `q`/`type`/`tag`/`sort` query, runs the active-only product search, and
 * renders the results in the shared browse grid inside the store chrome.
 */
export async function generateMetadata(): Promise<Metadata> {
  const store = await resolveStorefront();
  if (!store) return {};
  return buildStoreMetadata(store, { title: `Search — ${store.name}` });
}

/** Collapse a `searchParam` (string | string[] | undefined) to a single trimmed value. */
function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

const SORTS: ProductSort[] = ["newest", "price_asc", "price_desc", "title"];
function asSort(value: string | string[] | undefined): ProductSort | undefined {
  const v = first(value);
  return v && (SORTS as string[]).includes(v) ? (v as ProductSort) : undefined;
}

export default async function StoreSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const store = await resolveStorefront();
  if (!store) notFound();
  const storeId = store._id;

  const sp = await searchParams;
  const q = first(sp.q);
  const productType = first(sp.type);
  const tag = first(sp.tag);
  const sort = asSort(sp.sort);

  const [config, products] = await Promise.all([
    getThemeConfig(storeId),
    searchProducts(storeId, { q, productType, tag, status: "active", sort }),
    // Facets are fetched so future filter UI can consume them; not yet surfaced here.
    getProductFacets(storeId),
  ]);
  if (!config) notFound();

  return (
    <StoreFrame config={config} storeName={store.name}>
      <SearchView query={q ?? ""} products={products} currency={store.settings.currency} />
    </StoreFrame>
  );
}
