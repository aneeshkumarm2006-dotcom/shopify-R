"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import type { Section } from "@/types";
import { StoreLogo } from "@/components/storefront/store-logo";
import { useStorefront, useStoreHref } from "@/components/storefront/storefront-context";
import { STORE_HOME } from "@/components/storefront/shared";

interface NavItem {
  label: string;
  href: string;
}
interface HeaderSettings {
  promo?: string;
  showSearch?: boolean;
  showCart?: boolean;
  nav?: NavItem[];
}

/** Default announcement when the merchant hasn't set a promo (real-store texture). */
const DEFAULT_PROMO = "Free shipping over $75  ·  Easy 30-day returns  ·  Secure checkout";

/**
 * Storefront header (DESIGN §5.2) — optional promo bar, then a sticky, blurred bar
 * with the brand wordmark, nav, optional search affordance, and a cart icon carrying
 * a live count that opens the cart sheet. Condenses slightly on scroll. In `preview`
 * mode (builder) it's inert — no context, no navigation.
 */
export function StoreHeader({
  section,
  preview = false,
  onNavigate,
}: {
  section: Section;
  preview?: boolean;
  /** Builder-only: jump the preview to a real page instead of navigating away. */
  onNavigate?: (href: string) => void;
}) {
  const s = section.settings as HeaderSettings;
  const sf = useStorefront();
  const href = useStoreHref();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (preview) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [preview]);

  // Real-feel nav: prefer hand-configured nav; otherwise fall back to the store's
  // collections (threaded via context) so the header always has a browse menu.
  const configuredNav = s.nav ?? [];
  const nav = configuredNav.length ? configuredNav : preview ? [] : (sf?.navLinks ?? []);
  // A default announcement bar gives the storefront real-store texture even when the
  // merchant hasn't set a promo. Configured promo always wins.
  const promo = s.promo || DEFAULT_PROMO;

  return (
    <header
      style={{
        position: preview ? "relative" : "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(250,249,245,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {promo && (
        <div
          style={{
            background: "var(--warm-900)",
            color: "var(--warm-50)",
            textAlign: "center",
            fontSize: "var(--text-xs)",
            padding: "7px var(--space-4)",
            letterSpacing: "0.01em",
          }}
        >
          {promo}
        </div>
      )}
      <div
        className="store-container"
        style={{
          height: scrolled ? 60 : 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          transition: "height var(--dur-base) var(--ease-standard)",
        }}
      >
        <LogoLink preview={preview} name={sf?.storeName} onNavigate={onNavigate} />

        <nav
          aria-label="Primary"
          style={{
            display: "flex",
            gap: "var(--space-6)",
            fontSize: "var(--text-base)",
            color: "var(--warm-800)",
          }}
          className="store-header-nav"
        >
          {nav.map((item) =>
            preview ? (
              <button
                key={item.label}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate?.(item.href);
                }}
                style={{
                  fontWeight: 450,
                  font: "inherit",
                  color: "inherit",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: onNavigate ? "pointer" : "default",
                }}
              >
                {item.label}
              </button>
            ) : (
              <Link
                key={item.label}
                href={href(item.href)}
                style={{ fontWeight: 450, color: "inherit" }}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          {s.showSearch !== false && <HeaderSearch preview={preview} />}
          {!preview && (
            <Link
              href={href("/account")}
              className="iconbtn sz-36"
              aria-label={sf?.customer ? `Account · ${sf.customer.name}` : "Sign in"}
              style={{ color: "var(--warm-800)" }}
            >
              <Icon name="user" size={19} aria-hidden />
            </Link>
          )}
          {s.showCart !== false && (
            <button
              type="button"
              className="iconbtn sz-36"
              aria-label={`Cart${sf?.cartCount ? `, ${sf.cartCount} items` : ""}`}
              onClick={() => sf?.openCart()}
              disabled={preview}
              style={{ position: "relative", color: "var(--warm-800)" }}
            >
              <Icon name="cart" size={19} aria-hidden />
              {!!sf?.cartCount && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 0,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 999,
                    background: "var(--lime-400)",
                    color: "var(--warm-900)",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {sf.cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Header search affordance — an accessible expanding input. Collapsed, it's a search
 * icon button; activating it reveals a labelled text field that submits on Enter,
 * navigating to the tenant's `/search?q=…` (via the store-href helper, so the
 * `/s/<subdomain>` prefix is applied). Inert in builder `preview`.
 */
function HeaderSearch({ preview }: { preview: boolean }) {
  const href = useStoreHref();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (preview) {
    return <IconButton name="search" size={36} aria-label="Search" disabled />;
  }

  if (!open) {
    return (
      <IconButton
        name="search"
        size={36}
        aria-label="Search"
        aria-expanded={false}
        onClick={() => setOpen(true)}
      />
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    setOpen(false);
    router.push(href(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`));
  };

  return (
    <form
      role="search"
      onSubmit={submit}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        border: "1px solid var(--border-strong)",
        borderRadius: 999,
        padding: "2px 4px 2px 12px",
        background: "var(--surface)",
      }}
    >
      <label
        htmlFor="store-search"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        Search products
      </label>
      <input
        id="store-search"
        ref={inputRef}
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (!value.trim()) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search products"
        autoComplete="off"
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: "var(--text-sm)",
          color: "var(--warm-900)",
          // 160px on wide screens, shrinks on narrow viewports so the header right cluster fits
          width: "min(160px, 38vw)",
        }}
      />
      <IconButton name="search" size={28} aria-label="Submit search" type="submit" />
    </form>
  );
}

function LogoLink({
  preview,
  name,
  onNavigate,
}: {
  preview: boolean;
  name?: string;
  onNavigate?: (href: string) => void;
}) {
  const href = useStoreHref();
  const logo = <StoreLogo name={name} />;
  if (preview) {
    if (!onNavigate) return logo;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(STORE_HOME);
        }}
        aria-label="Store home"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        {logo}
      </button>
    );
  }
  return (
    <Link href={href(STORE_HOME)} aria-label="Store home">
      {logo}
    </Link>
  );
}
