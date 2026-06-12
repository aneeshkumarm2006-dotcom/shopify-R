import type { Product } from "@/types";
import { ProductCard } from "@/components/sections/product-card";

/**
 * Shared 4:5 product-card grid (DESIGN §5.3 / §5.4) — the single browse-grid markup
 * used by the collection view and the `/search` results. Callers handle their own
 * header / empty states; this just lays the cards out so the visual style stays
 * identical across browse surfaces.
 */
export function ProductGrid({
  products,
  currency = "$",
  cols = 4,
}: {
  products: Product[];
  currency?: string;
  cols?: number;
}) {
  return (
    <div className="store-grid" style={{ ["--cols" as string]: cols }}>
      {products.map((p) => (
        <ProductCard key={p._id} product={p} currency={currency} />
      ))}
    </div>
  );
}
