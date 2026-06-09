"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Stepper } from "@/components/ui/stepper";
import { Media } from "@/components/sections/media";
import type { Product } from "@/types";
import { money } from "@/lib/format";
import { useStorefront } from "./storefront-context";
import { STORE_HOME } from "./shared";
import { variantStock, productType } from "./shared";

/**
 * Product detail (DESIGN §5.4) — sticky gallery + thumb strip on the left; buy box on
 * the right with type eyebrow, Clash Display title, mono price + compare-at, variant
 * pill picker, stock note (in/low/out), qty stepper, add-to-cart, and a specs table +
 * description. Variant selection updates price / SKU / stock; out-of-stock honors the
 * variant's policy (deny → disabled CTA).
 */
export function ProductView({ product, currency = "$" }: { product: Product; currency?: string }) {
  const sf = useStorefront();
  const [vi, setVi] = useState(() =>
    Math.max(0, product.variants.findIndex((v) => variantStock(v) !== "out")),
  );
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const variant = product.variants[vi] ?? product.variants[0];
  const stock = variant ? variantStock(variant) : "out";
  const out = stock === "out";
  const onSale = variant?.compareAtPrice != null && variant.compareAtPrice > variant.price;
  const thumbs = product.images.length > 0 ? product.images : [null, null, null, null];

  const stockColor =
    stock === "out" ? "var(--critical)" : stock === "low" ? "var(--warning)" : "var(--success)";
  const stockLabel =
    stock === "out"
      ? "Sold out"
      : stock === "low"
        ? `Only ${variant?.inventory.quantity ?? 0} left`
        : "In stock";

  return (
    <div className="store-container" style={{ paddingTop: "var(--space-10)", paddingBottom: "var(--space-10)" }}>
      <Link
        href={STORE_HOME}
        className="btn btn-sm btn-ghost"
        style={{ marginBottom: 24, paddingLeft: 4, color: "var(--warm-600)" }}
      >
        <Icon name="chevronLeft" size={16} aria-hidden />
        <span>Back</span>
      </Link>

      <div className="store-split store-split-product">
        {/* Gallery */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 90 }}>
          <Media src={thumbs[activeImage]} alt={product.title} ratio="4 / 5" radius="var(--radius-xl)" iconSize={44} />
          <div style={{ display: "flex", gap: 10 }}>
            {thumbs.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImage(i)}
                aria-label={`View image ${i + 1}`}
                style={{
                  width: 70,
                  padding: 0,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  borderRadius: "var(--radius-md)",
                  outline: i === activeImage ? "2px solid var(--warm-900)" : "1px solid var(--border)",
                  outlineOffset: -1,
                }}
              >
                <Media src={src} ratio="4 / 5" radius="var(--radius-md)" iconSize={16} />
              </button>
            ))}
          </div>
        </div>

        {/* Buy box */}
        <div>
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--warm-500)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            {productType(product)}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "var(--text-2xl)",
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              color: "var(--warm-900)",
            }}
          >
            {product.title}
          </h1>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 16 }}>
            <span className="mono" style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--warm-900)" }}>
              {money(variant?.price ?? 0, currency)}
            </span>
            {onSale && (
              <span
                className="mono"
                style={{ fontSize: "var(--text-md)", color: "var(--text-muted)", textDecoration: "line-through" }}
              >
                {money(variant!.compareAtPrice!, currency)}
              </span>
            )}
          </div>

          {/* Variant picker */}
          {product.variants.length > 1 && (
            <div style={{ marginTop: 26 }}>
              <div style={{ fontSize: "var(--text-base)", fontWeight: 500, color: "var(--warm-800)", marginBottom: 10 }}>
                {product.options[0]?.name ?? "Options"}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {product.variants.map((vv, i) => {
                  const vOut = variantStock(vv) === "out";
                  const active = i === vi;
                  return (
                    <button
                      key={vv.id}
                      type="button"
                      onClick={() => {
                        setVi(i);
                        setQty(1);
                      }}
                      className="btn btn-md btn-pill"
                      aria-pressed={active}
                      style={{
                        background: active ? "var(--warm-900)" : "transparent",
                        color: active ? "var(--warm-50)" : "var(--warm-800)",
                        border: `1px solid ${active ? "var(--warm-900)" : "var(--border-strong)"}`,
                        fontFamily: "var(--font-mono)",
                        textDecoration: vOut ? "line-through" : undefined,
                        opacity: vOut ? 0.6 : 1,
                      }}
                    >
                      {vv.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock note */}
          <div
            style={{
              marginTop: 22,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "var(--text-base)",
              color: stockColor,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} aria-hidden />
            {stockLabel}
          </div>

          {/* Add to cart */}
          <div style={{ display: "flex", gap: 12, marginTop: 24, alignItems: "center" }}>
            {!out && <Stepper value={qty} min={1} onChange={setQty} aria-label="Quantity" />}
            <button
              type="button"
              onClick={() => !out && variant && sf?.addToCart(product, variant, qty)}
              disabled={out}
              className="btn btn-lg btn-pill"
              style={{
                flex: 1,
                background: out ? "var(--surface-sunken)" : "var(--lime-400)",
                color: out ? "var(--text-muted)" : "var(--warm-900)",
                fontWeight: 600,
                cursor: out ? "not-allowed" : "pointer",
              }}
            >
              {out ? "Sold out" : "Add to cart"}
            </button>
          </div>

          {/* Description + specs */}
          <div style={{ marginTop: 32, paddingTop: 28, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--warm-900)", marginBottom: 10 }}>
              About this product
            </div>
            <p style={{ fontSize: "var(--text-md)", lineHeight: 1.65, color: "var(--text)" }}>
              {product.description}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 20 }}>
              {[
                ["SKU", variant?.sku ?? "—"],
                ["Type", productType(product)],
                ["Lab-tested", "Yes"],
              ].map(([k, val]) => (
                <div key={k}>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {k}
                  </div>
                  <div className="mono" style={{ fontSize: "var(--text-base)", color: "var(--warm-900)", marginTop: 3 }}>
                    {val}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
