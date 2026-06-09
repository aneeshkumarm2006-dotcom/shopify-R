import type { Collection, Product } from "@/types";
import { ProductCard } from "@/components/sections/product-card";
import { EmptyState } from "@/components/ui/states";

/**
 * Collection listing (DESIGN §5.4) — title + a simple product count, then the 4:5
 * product-card grid. No faceted filters in MVP (out of scope); an empty collection
 * renders a designed empty state, not a broken grid.
 */
export function CollectionView({
  collection,
  products,
  currency = "$",
}: {
  collection: Collection;
  products: Product[];
  currency?: string;
}) {
  return (
    <div className="store-container" style={{ paddingTop: "var(--space-12)", paddingBottom: "var(--space-12)" }}>
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
          {collection.title}
        </h1>
        <p style={{ marginTop: 8, fontSize: "var(--text-base)", color: "var(--text-muted)" }}>
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </header>

      {products.length === 0 ? (
        <EmptyState
          icon="box"
          title="Nothing here yet"
          body="This collection doesn't have any products right now. Check back soon."
        />
      ) : (
        <div className="store-grid" style={{ ["--cols" as string]: 4 }}>
          {products.map((p) => (
            <ProductCard key={p._id} product={p} currency={currency} />
          ))}
        </div>
      )}
    </div>
  );
}
