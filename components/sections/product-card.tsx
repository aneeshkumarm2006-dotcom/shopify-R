"use client";

import Link from "next/link";
import { Media } from "./media";
import type { Product } from "@/types";
import { money } from "@/lib/format";
import { useStorefront } from "@/components/storefront/storefront-context";
import {
  defaultVariant,
  fromPrice,
  productInStock,
  productType,
  saleVariant,
} from "@/components/storefront/shared";

/**
 * Product card (DESIGN §5.3 / §5.4) — 4:5 image, sale / sold-out badge, title, type,
 * mono price (+ struck compare-at), and a quick "Add" that drops the default variant
 * into the cart. Used by `featured_products` and the collection grid. In `preview`
 * mode the card is inert (no context, no navigation) so the builder can show it.
 */
export function ProductCard({
  product,
  currency = "$",
  preview = false,
}: {
  product: Product;
  currency?: string;
  preview?: boolean;
}) {
  const sf = useStorefront();
  const onSale = saleVariant(product);
  const soldOut = !productInStock(product);
  const price = fromPrice(product);

  const add = (e: React.MouseEvent) => {
    e.preventDefault();
    if (soldOut) return;
    const v = defaultVariant(product);
    if (v && sf) sf.addToCart(product, v, 1);
  };

  const card = (
    <>
      <div style={{ position: "relative" }}>
        <Media src={product.images[0]} alt={product.title} ratio="4 / 5" />
        {onSale && !soldOut && <Badge label="Sale" tone="lime" />}
        {soldOut && <Badge label="Sold out" tone="ink" />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: "var(--space-3)" }}>
        <span style={{ fontWeight: 500, fontSize: "var(--text-base)", color: "var(--text-strong)" }}>
          {product.title}
        </span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          {productType(product)}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "var(--space-2)",
          gap: "var(--space-2)",
        }}
      >
        <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            className="mono"
            style={{ fontSize: "var(--text-base)", fontWeight: 500, color: "var(--text-strong)" }}
          >
            {money(price, currency)}
          </span>
          {onSale?.compareAtPrice != null && (
            <span
              className="mono"
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                textDecoration: "line-through",
              }}
            >
              {money(onSale.compareAtPrice, currency)}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={add}
          disabled={soldOut || preview}
          className="btn btn-sm btn-pill"
          aria-label={soldOut ? `${product.title} sold out` : `Add ${product.title} to cart`}
          style={{
            background: soldOut ? "var(--surface-sunken)" : "var(--warm-900)",
            color: soldOut ? "var(--text-muted)" : "var(--warm-50)",
            cursor: soldOut ? "not-allowed" : "pointer",
          }}
        >
          {soldOut ? "Sold out" : "Add"}
        </button>
      </div>
    </>
  );

  const style: React.CSSProperties = { display: "block", color: "inherit" };

  if (preview) return <div style={style}>{card}</div>;
  return (
    <Link href={`/products/${product.handle}`} style={style}>
      {card}
    </Link>
  );
}

function Badge({ label, tone }: { label: string; tone: "lime" | "ink" }) {
  return (
    <span
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        background: tone === "lime" ? "var(--lime-400)" : "var(--warm-900)",
        color: tone === "lime" ? "var(--warm-900)" : "var(--warm-50)",
      }}
    >
      {label}
    </span>
  );
}
