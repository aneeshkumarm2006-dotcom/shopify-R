"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { Product, Section } from "@/types";
import { Media } from "./media";
import { ProductCard } from "./product-card";
import { EmptyState } from "@/components/ui/states";
import { sanitizeHtmlFragment } from "@/lib/sanitize/inject";
import { useStoreHref } from "@/components/storefront/storefront-context";

/**
 * The closed MVP section set (DESIGN §5.3) — `hero`, `featured_products`,
 * `collection_list`, `rich_text`, `image_with_text`, `gallery`, `newsletter_static`,
 * `custom_html`. No section types exist beyond this set (PRD §6.2 closed builder).
 *
 * Every section ships sensible default/empty content so a freshly-added section
 * never looks broken in the builder preview. All are settings-driven; product-bearing
 * sections resolve against the `products` passed by the renderer (no async here, so
 * the same component powers the live store and the builder's local-state preview).
 */
export interface SectionProps {
  section: Section;
  products: Product[];
  currency?: string;
  preview?: boolean;
  /** Builder-only: resolve+jump to the real page a link/tile/card would navigate to. */
  onNavigate?: (href: string) => void;
}

/* ---------------------------------------------------------------- hero ---- */
export function HeroSection({ section, preview, onNavigate }: SectionProps) {
  const s = section.settings as {
    badge?: string;
    heading?: string;
    subtext?: string;
    cta?: string;
    ctaHref?: string;
    align?: "left" | "center";
    height?: "short" | "tall";
    image?: string;
  };
  const tall = s.height === "tall";
  const center = s.align === "center";
  const cta = s.cta;

  return (
    <section
      style={{
        position: "relative",
        minHeight: tall ? 560 : 440,
        display: "flex",
        alignItems: "center",
        background: "var(--warm-900)",
        overflow: "hidden",
      }}
    >
      {s.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={s.image}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }}
        />
      ) : (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(120% 120% at 80% 10%, #23201a 0%, #16140E 60%)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: -80,
              top: "50%",
              transform: "translateY(-50%)",
              width: 420,
              height: 420,
              borderRadius: "50%",
              background: "var(--lime-400)",
              opacity: 0.1,
              filter: "blur(8px)",
            }}
          />
        </>
      )}
      <div className="store-container" style={{ position: "relative" }}>
        <div style={{ maxWidth: 560, marginInline: center ? "auto" : undefined, textAlign: center ? "center" : "left" }}>
          {s.badge && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 12px",
                borderRadius: 999,
                border: "1px solid rgba(198,242,78,0.3)",
                color: "var(--lime-400)",
                fontSize: "var(--text-sm)",
                marginBottom: 22,
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--lime-400)" }} />
              {s.badge}
            </span>
          )}
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "clamp(40px, 5.5vw, 64px)",
              lineHeight: 1.04,
              letterSpacing: "-0.01em",
              color: "var(--warm-50)",
              whiteSpace: "pre-line",
              margin: 0,
            }}
          >
            {s.heading ?? "Your headline here"}
          </h1>
          {s.subtext && (
            <p
              style={{
                marginTop: 20,
                fontSize: "var(--text-md)",
                lineHeight: 1.55,
                color: "rgba(250,249,245,0.72)",
                maxWidth: 460,
                marginInline: center ? "auto" : undefined,
              }}
            >
              {s.subtext}
            </p>
          )}
          {cta && (
            <div
              style={{
                marginTop: 30,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                justifyContent: center ? "center" : "flex-start",
              }}
            >
              <CtaButton href={s.ctaHref} preview={preview} onNavigate={onNavigate} primary>
                {cta}
              </CtaButton>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------- featured_products ---- */
export function FeaturedProductsSection({ section, products, currency, preview, onNavigate }: SectionProps) {
  const s = section.settings as { title?: string; productIds?: string[]; columns?: number };
  const byId = new Map(products.map((p) => [p._id, p]));
  const picked = (s.productIds ?? [])
    .map((id) => byId.get(id))
    .filter((p): p is Product => Boolean(p));
  const cols = s.columns ?? 4;

  return (
    <section style={{ padding: "var(--space-20) 0" }}>
      <div className="store-container">
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 36,
            gap: "var(--space-4)",
          }}
        >
          <h2 className="store-section-title">{s.title ?? "Featured products"}</h2>
        </div>
        {picked.length === 0 ? (
          <EmptyState icon="box" title="No products selected" body="Pick products to feature in this section." />
        ) : (
          <div className="store-grid" style={{ ["--cols" as string]: cols }}>
            {picked.map((p) => (
              <ProductCard key={p._id} product={p} currency={currency} preview={preview} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------- collection_list ---- */
export function CollectionListSection({ section, preview, onNavigate }: SectionProps) {
  const s = section.settings as {
    title?: string;
    columns?: number;
    collections?: { name: string; handle?: string; count?: number }[];
  };
  const cols = s.columns ?? 4;
  const all = s.collections ?? [];
  // Real-feel: on the live storefront, hide empty (0-product) categories so the page
  // never shows a wall of "0 products" tiles. In the builder (preview) keep them all
  // visible so the merchant can still see/edit every configured collection.
  const list = preview ? all : all.filter((c) => c.count === undefined || c.count > 0);
  if (!preview && list.length === 0) return null;

  return (
    <section style={{ padding: "var(--space-16) 0" }}>
      <div className="store-container">
        <h2 className="store-section-title" style={{ marginBottom: 32 }}>
          {s.title ?? "Shop by category"}
        </h2>
        <div className="store-grid" style={{ ["--cols" as string]: cols }}>
          {list.map((c, i) => {
            const tile = (
              <div
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--warm-900)",
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "flex-end",
                  padding: "var(--space-5)",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "radial-gradient(100% 100% at 30% 0%, #2a261d 0%, #16140E 70%)",
                  }}
                />
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: "var(--text-lg)",
                      color: "var(--warm-50)",
                    }}
                  >
                    {c.name}
                  </div>
                  {c.count != null && (
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--lime-400)", marginTop: 2 }}>
                      {c.count} {c.count === 1 ? "product" : "products"}
                    </div>
                  )}
                </div>
              </div>
            );
            if (preview && c.handle) {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate?.(`/collections/${c.handle}`);
                  }}
                  style={{ display: "block", width: "100%", padding: 0, border: "none", background: "none", textAlign: "inherit", cursor: onNavigate ? "pointer" : "default" }}
                >
                  {tile}
                </button>
              );
            }
            return preview || !c.handle ? (
              <div key={i}>{tile}</div>
            ) : (
              <CollectionTile key={i} handle={c.handle}>
                {tile}
              </CollectionTile>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- rich_text ---- */
export function RichTextSection({ section }: SectionProps) {
  const s = section.settings as {
    heading?: string;
    body?: string;
    align?: "left" | "center";
    width?: number;
  };
  return (
    <section style={{ padding: "var(--space-16) 0" }}>
      <div
        style={{
          maxWidth: s.width ?? 680,
          margin: "0 auto",
          paddingInline: "var(--space-8)",
          textAlign: s.align ?? "center",
        }}
      >
        {s.heading && (
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "var(--text-2xl)",
              color: "var(--warm-900)",
              marginBottom: 16,
            }}
          >
            {s.heading}
          </h2>
        )}
        <p style={{ fontSize: "var(--text-md)", lineHeight: 1.7, color: "var(--text)" }}>
          {s.body ?? "Add your text here."}
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------- image_with_text ---- */
export function ImageWithTextSection({ section, preview }: SectionProps) {
  const s = section.settings as {
    heading?: string;
    body?: string;
    cta?: string;
    ctaHref?: string;
    side?: "left" | "right";
    image?: string;
  };
  const media = (
    <div className="store-iwt-media" style={{ minHeight: 320 }}>
      <Media src={s.image} ratio="4 / 3" radius="var(--radius-xl)" icon="image" iconSize={36} fill />
    </div>
  );
  const text = (
    <div
      className="store-iwt-text"
      style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}
    >
      <h2 className="store-section-title">{s.heading ?? "Tell your story"}</h2>
      {s.body && (
        <p style={{ marginTop: 18, fontSize: "var(--text-md)", lineHeight: 1.6, color: "var(--text)", maxWidth: 440 }}>
          {s.body}
        </p>
      )}
      {s.cta && (
        <div style={{ marginTop: 26 }}>
          <CtaButton href={s.ctaHref} preview={preview}>
            {s.cta}
          </CtaButton>
        </div>
      )}
    </div>
  );
  return (
    <section style={{ padding: "var(--space-16) 0", background: "var(--warm-0)" }}>
      <div className="store-container store-split store-split-iwt">
        {s.side === "right" ? (
          <>
            {text}
            {media}
          </>
        ) : (
          <>
            {media}
            {text}
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ gallery ---- */
export function GallerySection({ section }: SectionProps) {
  const s = section.settings as { images?: string[]; columns?: number; gap?: number };
  const cols = s.columns ?? 3;
  // Default to three placeholders so a fresh section reads as a gallery, not empty.
  const images = s.images && s.images.length > 0 ? s.images : [null, null, null];
  return (
    <section style={{ padding: "var(--space-16) 0" }}>
      <div className="store-container">
        <div className="store-grid" style={{ ["--cols" as string]: cols, gap: s.gap ?? undefined }}>
          {images.map((src, i) => (
            <Media key={i} src={src} ratio="1 / 1" icon="image" />
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------- newsletter_static ---- */
export function NewsletterStaticSection({ section, preview }: SectionProps) {
  const s = section.settings as {
    heading?: string;
    subtext?: string;
    placeholder?: string;
    button?: string;
  };
  const [done, setDone] = useState(false);
  return (
    <section style={{ padding: "var(--space-16) 0" }}>
      <div className="store-container">
        <div
          style={{
            background: "var(--lime-100)",
            border: "1px solid var(--lime-200)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-12) var(--space-10)",
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-8)",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "var(--text-2xl)",
                color: "var(--warm-900)",
                letterSpacing: "-0.01em",
              }}
            >
              {s.heading ?? "Stay in the loop"}
            </h2>
            {s.subtext && (
              <p style={{ marginTop: 10, fontSize: "var(--text-base)", color: "var(--warm-700)", lineHeight: 1.5 }}>
                {s.subtext}
              </p>
            )}
          </div>
          {/* Static capture only — stores nothing in MVP (DESIGN §5.2). */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setDone(true);
            }}
            style={{ display: "flex", gap: 10, minWidth: 0, flex: 1, maxWidth: 420 }}
          >
            <input
              type="email"
              className="input input-lg"
              placeholder={s.placeholder ?? "you@email.com"}
              aria-label="Email address"
              disabled={preview}
              style={{ flex: 1, background: "var(--warm-0)", borderColor: "transparent" }}
            />
            <button
              type="submit"
              className="btn btn-lg btn-pill"
              disabled={preview}
              style={{ background: "var(--warm-900)", color: "var(--warm-50)", whiteSpace: "nowrap" }}
            >
              {done ? "Thanks ✓" : (s.button ?? "Subscribe")}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- custom_html ---- */
export function CustomHtmlSection({ section }: SectionProps) {
  const s = section.settings as { html?: string };
  if (!s.html) {
    return (
      <section style={{ padding: "var(--space-12) 0" }}>
        <div className="store-container">
          <EmptyState icon="code" title="Custom HTML" body="Paste HTML in this section's settings to render it here." />
        </div>
      </section>
    );
  }
  // Merchant-supplied HTML is sanitized before rendering — `<base>` hijacks are
  // stripped and the content is length-capped; the self-XSS scope is documented in
  // `lib/sanitize/inject` (PRD §9).
  return (
    <section style={{ padding: "var(--space-12) 0" }}>
      <div
        className="store-container"
        dangerouslySetInnerHTML={{ __html: sanitizeHtmlFragment(s.html) }}
      />
    </section>
  );
}

/* --------------------------------------------------------------- util ---- */
function CollectionTile({ handle, children }: { handle: string; children: React.ReactNode }) {
  const href = useStoreHref();
  return (
    <Link href={href(`/collections/${handle}`)} style={{ display: "block" }}>
      {children}
    </Link>
  );
}

function CtaButton({
  href,
  children,
  primary,
  preview,
  onNavigate,
}: {
  href?: string;
  children: React.ReactNode;
  primary?: boolean;
  preview?: boolean;
  onNavigate?: (href: string) => void;
}) {
  const toHref = useStoreHref();
  const className = "btn btn-lg btn-pill";
  const style: React.CSSProperties = primary
    ? { background: "var(--lime-400)", color: "var(--warm-900)", fontWeight: 600 }
    : { background: "var(--warm-900)", color: "var(--warm-50)" };
  const content = (
    <>
      <span>{children}</span>
      <Icon name="arrowRight" size={17} aria-hidden />
    </>
  );
  if (preview || !href) {
    // In the builder, a configured href still jumps the preview to that page — it
    // just never leaves the editor. No href at all stays inert (nothing to jump to).
    if (preview && href && onNavigate) {
      return (
        <button
          type="button"
          className={className}
          style={{ ...style, border: "none", cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(href);
          }}
        >
          {content}
        </button>
      );
    }
    return (
      <span className={className} style={{ ...style, cursor: "default" }}>
        {content}
      </span>
    );
  }
  return (
    <Link href={toHref(href)} className={className} style={style}>
      {content}
    </Link>
  );
}
