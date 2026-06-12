"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/types";
import { ProductGrid } from "./product-grid";
import { NoResultsState } from "@/components/ui/states";

/** Client-side browse sort keys (mirrors the server `ProductSort`, kept local so this
 *  client component doesn't import the server-only data layer). */
type Sort = "newest" | "price_asc" | "price_desc" | "title";

const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Featured" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "title", label: "Title" },
];

/** Lowest variant price — inline equivalent of the server-only `minVariantPrice`. */
function fromPrice(p: Product): number {
  return p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : 0;
}

function sortProducts(rows: Product[], sort: Sort): Product[] {
  const out = [...rows];
  switch (sort) {
    case "price_asc":
      return out.sort((a, b) => fromPrice(a) - fromPrice(b));
    case "price_desc":
      return out.sort((a, b) => fromPrice(b) - fromPrice(a));
    case "title":
      return out.sort((a, b) => a.title.localeCompare(b.title));
    case "newest":
    default:
      return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
}

const selectStyle: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  background: "var(--surface)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-md)",
  padding: "8px 30px 8px 12px",
  fontSize: "var(--text-sm)",
  color: "var(--warm-800)",
  cursor: "pointer",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: "var(--text-xs)",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontWeight: 600,
};

/**
 * Interactive filter + sort over an already-loaded product list (DESIGN §5.4). The
 * collection page fetches once on the server; this client child only narrows and
 * re-orders that list in memory — no refetch. Filter options are derived from the
 * loaded products (or passed in as facets) so we never show an empty dropdown.
 */
export function CollectionFilterBar({
  products,
  currency = "$",
  productTypes,
  tags,
}: {
  products: Product[];
  currency?: string;
  productTypes?: string[];
  tags?: string[];
}) {
  const [type, setType] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const typeOptions = useMemo(() => {
    if (productTypes?.length) return productTypes;
    const set = new Set<string>();
    for (const p of products) if (p.productType) set.add(p.productType);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [products, productTypes]);

  const tagOptions = useMemo(() => {
    if (tags?.length) return tags;
    const set = new Set<string>();
    for (const p of products) for (const t of p.tags ?? []) if (t) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [products, tags]);

  const visible = useMemo(() => {
    let rows = products;
    if (type) rows = rows.filter((p) => p.productType === type);
    if (tag) rows = rows.filter((p) => (p.tags ?? []).includes(tag));
    return sortProducts(rows, sort);
  }, [products, type, tag, sort]);

  const hasFilters = type !== "" || tag !== "";
  const clear = () => {
    setType("");
    setTag("");
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: "var(--space-4)",
          marginBottom: "var(--space-8)",
        }}
      >
        {typeOptions.length > 0 && (
          <label style={labelStyle}>
            Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={selectStyle}
              aria-label="Filter by product type"
            >
              <option value="">All types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        )}

        {tagOptions.length > 0 && (
          <label style={labelStyle}>
            Tag
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              style={selectStyle}
              aria-label="Filter by tag"
            >
              <option value="">All tags</option>
              {tagOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        )}

        <label style={{ ...labelStyle, marginLeft: "auto" }}>
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            style={selectStyle}
            aria-label="Sort products"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <NoResultsState
          onClear={hasFilters ? clear : undefined}
          label="No products match these filters"
        />
      ) : (
        <ProductGrid products={visible} currency={currency} />
      )}
    </>
  );
}
