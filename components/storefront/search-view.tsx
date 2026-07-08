import type { Product } from "@/types";
import { CollectionFilterBar } from "./collection-filter-bar";
import { Breadcrumbs } from "./breadcrumbs";
import { EmptyState } from "@/components/ui/states";

/**
 * Storefront search results (DESIGN §5.4) — echoes the query and result count, then
 * the same 4:5 browse grid the collection page uses. Server component: the
 * `/search` page does the (server-side) `searchProducts` query and hands the results
 * here. A zero-result query gets a warm empty state, not a broken grid.
 */
export function SearchView({
  query,
  products,
  currency = "$",
}: {
  query: string;
  products: Product[];
  currency?: string;
}) {
  const count = products.length;
  const trimmed = query.trim();

  return (
    <div
      className="store-container"
      style={{ paddingTop: "var(--space-10)", paddingBottom: "var(--space-12)" }}
    >
      <Breadcrumbs items={[{ label: trimmed ? `Search: ${trimmed}` : "Search" }]} />
      <header style={{ marginBottom: "var(--space-10)" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "var(--text-2xl)",
            letterSpacing: "-0.01em",
            color: "var(--warm-900)",
          }}
        >
          {trimmed ? <>Search results for &ldquo;{trimmed}&rdquo;</> : "Search"}
        </h1>
        {trimmed && (
          <p style={{ marginTop: 8, fontSize: "var(--text-base)", color: "var(--text-muted)" }}>
            {count} {count === 1 ? "result" : "results"}
          </p>
        )}
      </header>

      {!trimmed ? (
        <EmptyState
          icon="search"
          title="Search the store"
          body="Type a product name, type, or tag to find what you're looking for."
        />
      ) : count === 0 ? (
        <EmptyState
          icon="search"
          title={`No products match “${trimmed}”`}
          body="Try a different search term or browse the collections."
        />
      ) : (
        <CollectionFilterBar products={products} currency={currency} />
      )}
    </div>
  );
}
