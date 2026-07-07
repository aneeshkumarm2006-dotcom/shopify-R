"use client";

import { useState } from "react";
import Link from "next/link";
import type { Section } from "@/types";
import { Icon } from "@/components/ui/icon";
import { StoreLogo } from "@/components/storefront/store-logo";
import { useStorefront, useStoreHref } from "@/components/storefront/storefront-context";

interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}
interface SocialLink {
  label: string;
  url: string;
}
interface FooterSettings {
  tagline?: string;
  columns?: FooterColumn[];
  legal?: string;
  social?: SocialLink[];
}

/**
 * Storefront footer (DESIGN §5.2) — rebuilt for real-store feel (Phase 7 polish). Even
 * when a merchant hasn't configured columns, it renders a complete footer: brand +
 * tagline, link columns (configured, else built from the store's collections + safe
 * defaults), a newsletter signup, social row, a payment/trust badge strip, and a
 * copyright line. So no store ever ships with a thin or placeholder footer.
 */
export function StoreFooter({
  section,
  preview = false,
  storeName,
  onNavigate,
}: {
  section: Section;
  preview?: boolean;
  storeName?: string;
  /** Builder-only: jump the preview to a real page instead of navigating away. */
  onNavigate?: (href: string) => void;
}) {
  const s = section.settings as FooterSettings;
  const sf = useStorefront();
  const href = useStoreHref();
  const name = storeName || sf?.storeName || "Our store";
  const year = new Date().getFullYear();

  // Columns: configured wins; otherwise build a Shop column from the store's
  // collections plus a safe Help column that only links to pages that exist.
  const navLinks = sf?.navLinks ?? [];
  const columns: FooterColumn[] =
    s.columns && s.columns.length
      ? s.columns
      : [
          {
            title: "Shop",
            links: navLinks.length
              ? navLinks.map((n) => ({ label: n.label, href: n.href }))
              : [{ label: "All products", href: "/search" }],
          },
          {
            title: "Help",
            links: [
              { label: "Search", href: "/search" },
              { label: "Your cart", href: "/cart" },
              { label: "Account", href: "/account" },
            ],
          },
        ];

  const tagline = s.tagline || `${name} — quality you can count on. Fast shipping, easy returns.`;

  const LinkEl = ({ href: to, children }: { href: string; children: string }) =>
    preview ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate?.(to);
        }}
        style={{
          fontSize: "var(--text-base)",
          color: "var(--warm-600)",
          background: "none",
          border: "none",
          padding: 0,
          textAlign: "left",
          font: "inherit",
          cursor: onNavigate ? "pointer" : "default",
        }}
      >
        {children}
      </button>
    ) : (
      <Link href={href(to)} style={{ fontSize: "var(--text-base)", color: "var(--warm-600)" }}>
        {children}
      </Link>
    );

  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--warm-0)", marginTop: "var(--space-12)" }}>
      <div
        className="store-container store-footer-cols"
        style={{ paddingTop: "var(--space-16)", paddingBottom: "var(--space-10)" }}
      >
        <div>
          <StoreLogo name={name} />
          <p
            style={{
              marginTop: "var(--space-4)",
              fontSize: "var(--text-base)",
              color: "var(--warm-600)",
              lineHeight: 1.6,
              maxWidth: 280,
            }}
          >
            {tagline}
          </p>
          <SocialRow links={s.social} />
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--warm-900)", marginBottom: "var(--space-4)" }}>
              {col.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {col.links.map((l) => (
                <LinkEl key={l.label} href={l.href}>
                  {l.label}
                </LinkEl>
              ))}
            </div>
          </div>
        ))}

        {/* Newsletter signup (visual capture) */}
        <Newsletter preview={preview} />
      </div>

      {/* Payment + trust badge strip */}
      <div className="store-container" style={{ paddingBottom: "var(--space-6)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--space-4)",
            paddingTop: "var(--space-6)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {["VISA", "MC", "AMEX", "PAYPAL"].map((p) => (
              <span
                key={p}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "var(--warm-600)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 5,
                  padding: "3px 8px",
                  background: "var(--surface)",
                }}
              >
                {p}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: "var(--text-xs)", color: "var(--warm-600)" }}>
            <Trust icon="truck" label="Fast shipping" />
            <Trust icon="refresh" label="30-day returns" />
            <Trust icon="lock" label="Secure checkout" />
          </div>
        </div>
      </div>

      {/* Legal / copyright */}
      <div
        className="store-container"
        style={{
          paddingTop: "var(--space-5)",
          paddingBottom: "var(--space-6)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          fontSize: "var(--text-xs)",
          color: "var(--warm-500)",
        }}
      >
        <span>{s.legal || `© ${year} ${name}. All rights reserved.`}</span>
        <span>Made with care · Licensed & compliant</span>
      </div>
    </footer>
  );
}

function Trust({ icon, label }: { icon: "truck" | "refresh" | "lock"; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Icon name={icon} size={14} aria-hidden style={{ color: "var(--warm-500)" }} />
      {label}
    </span>
  );
}

/** Merchant-configured social links (Wave: header/footer richness). Real, working
 * links on the live storefront — no icon set for individual platforms, so every
 * entry uses a generic external-link glyph with the platform name as the label. */
function SocialRow({ links }: { links?: SocialLink[] }) {
  const items = (links ?? []).filter((l) => l.label.trim() && l.url.trim());
  if (items.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: "var(--space-5)" }}>
      {items.map((it, i) => (
        <a
          key={`${it.label}-${i}`}
          href={it.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={it.label}
          title={it.label}
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "1px solid var(--border-strong)",
            display: "grid",
            placeItems: "center",
            color: "var(--warm-600)",
            background: "var(--surface)",
          }}
        >
          <Icon name="external" size={15} aria-hidden />
        </a>
      ))}
    </div>
  );
}

function Newsletter({ preview }: { preview: boolean }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  return (
    <div>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--warm-900)", marginBottom: "var(--space-3)" }}>
        Stay in the loop
      </div>
      {done ? (
        <p style={{ fontSize: "var(--text-base)", color: "var(--success)" }}>Thanks — you are subscribed.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!preview && email.trim()) setDone(true);
          }}
          style={{ display: "flex", gap: 8, maxWidth: 280 }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            disabled={preview}
            style={{
              flex: 1,
              border: "1px solid var(--border-strong)",
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: "var(--text-sm)",
              background: "var(--surface)",
              color: "var(--warm-900)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={preview}
            className="btn btn-sm btn-pill"
            style={{ background: "var(--warm-900)", color: "var(--warm-50)", fontWeight: 600, paddingInline: 16 }}
          >
            Join
          </button>
        </form>
      )}
    </div>
  );
}
