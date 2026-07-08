"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet } from "@/components/ui/sheet";
import { Thumb } from "@/components/ui/thumb";
import type { Section } from "@/types";
import { money } from "@/lib/format";
import { StoreLogo } from "@/components/storefront/store-logo";
import { useStorefront, useStoreHref } from "@/components/storefront/storefront-context";
import { STORE_HOME } from "@/components/storefront/shared";
import { searchSuggest, type SearchSuggestion } from "@/app/(store)/actions";

interface NavItem {
  label: string;
  href: string;
}
interface SocialLink {
  label: string;
  url: string;
}
interface HeaderSettings {
  promo?: string;
  showSearch?: boolean;
  showCart?: boolean;
  nav?: NavItem[];
  social?: SocialLink[];
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
  const [menuOpen, setMenuOpen] = useState(false);

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
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", minWidth: 0 }}>
          {!preview && nav.length > 0 && (
            <button
              type="button"
              className="iconbtn sz-36 store-header-menu-btn"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              style={{ color: "var(--warm-800)" }}
            >
              <Icon name="menu" size={20} aria-hidden />
            </button>
          )}
          <LogoLink preview={preview} name={sf?.storeName} onNavigate={onNavigate} />
        </div>

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
          {!!s.social?.length && (
            <div style={{ display: "flex", alignItems: "center", gap: 2, marginRight: 4 }}>
              {s.social.filter((l) => l.label.trim() && l.url.trim()).map((l, i) =>
                preview ? (
                  <span key={`${l.label}-${i}`} className="iconbtn sz-36" style={{ color: "var(--warm-800)" }}>
                    <Icon name="external" size={16} aria-hidden />
                  </span>
                ) : (
                  <a
                    key={`${l.label}-${i}`}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="iconbtn sz-36"
                    aria-label={l.label}
                    title={l.label}
                    style={{ color: "var(--warm-800)" }}
                  >
                    <Icon name="external" size={16} aria-hidden />
                  </a>
                ),
              )}
            </div>
          )}
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

      {!preview && (
        <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" width={360}>
          <nav aria-label="Mobile" style={{ display: "flex", flexDirection: "column" }}>
            {nav.map((item) => (
              <Link
                key={item.label}
                href={href(item.href)}
                onClick={() => setMenuOpen(false)}
                style={{
                  padding: "14px 4px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: "var(--text-lg)",
                  fontWeight: 500,
                  color: "var(--warm-900)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                {item.label}
                <Icon name="chevronRight" size={18} aria-hidden style={{ color: "var(--warm-400)" }} />
              </Link>
            ))}
            <Link
              href={href("/account")}
              onClick={() => setMenuOpen(false)}
              style={{
                marginTop: "var(--space-4)",
                padding: "14px 4px",
                fontSize: "var(--text-base)",
                fontWeight: 500,
                color: "var(--warm-700)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Icon name="user" size={18} aria-hidden />
              {sf?.customer ? sf.customer.name : "Sign in"}
            </Link>
          </nav>
        </Sheet>
      )}
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
  const currency = useStorefront()?.currency ?? "$";
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Predictive results: debounce the query, then fetch the tenant's top matches.
  // A ref-guarded "latest" token drops out-of-order responses so fast typing can't
  // flash a stale result set.
  const q = value.trim();
  const reqRef = useRef(0);
  useEffect(() => {
    if (!open) return;
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const token = ++reqRef.current;
    const t = setTimeout(async () => {
      try {
        const hits = await searchSuggest(q);
        if (token === reqRef.current) setResults(hits);
      } catch {
        if (token === reqRef.current) setResults([]);
      } finally {
        if (token === reqRef.current) setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
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

  const go = (path: string) => {
    setOpen(false);
    setValue("");
    router.push(href(path));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    go(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
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
        <label htmlFor="store-search" className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
          Search products
        </label>
        <input
          id="store-search"
          ref={inputRef}
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search products"
          autoComplete="off"
          role="combobox"
          aria-expanded={q.length >= 2}
          aria-controls="store-search-results"
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "var(--text-sm)",
            color: "var(--warm-900)",
            width: "min(200px, 44vw)",
          }}
        />
        <IconButton name="search" size={28} aria-label="Submit search" type="submit" />
      </form>

      {q.length >= 2 && (
        <div
          id="store-search-results"
          role="listbox"
          className="predictive-search-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "min(380px, 92vw)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg, 0 12px 32px rgba(0,0,0,0.14))",
            overflow: "hidden",
            zIndex: 200,
          }}
        >
          {loading && results.length === 0 ? (
            <p style={{ margin: 0, padding: "16px 14px", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p style={{ margin: 0, padding: "16px 14px", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              No matches for &ldquo;{q}&rdquo;
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 4 }}>
              {results.map((r) => (
                <li key={r.handle}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => go(`/products/${r.handle}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      width: "100%",
                      padding: "8px 10px",
                      border: "none",
                      background: "none",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    className="predictive-search-row"
                  >
                    <Thumb src={r.image} ratio="4 / 5" size={42} radius="var(--radius-sm)" />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.title}
                      </span>
                      {r.productType && (
                        <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                          {r.productType}
                        </span>
                      )}
                    </span>
                    <span className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--text-strong)" }}>
                      {money(r.price, currency)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={submit}
            style={{
              display: "block",
              width: "100%",
              padding: "11px 14px",
              border: "none",
              borderTop: "1px solid var(--border)",
              background: "none",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              color: "var(--warm-800)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            Search for &ldquo;{q}&rdquo; →
          </button>
        </div>
      )}
    </div>
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
