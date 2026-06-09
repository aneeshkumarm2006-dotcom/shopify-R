"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cx } from "@/components/ui/cx";

/**
 * Marketing header (Stage 5) — sticky, blurred bar for Offshelf's apex landing page.
 * Mirrors the storefront header pattern (sticky + blur) but serves the platform's own
 * site: brand, in-page anchor nav, theme toggle, and the two CTAs into the admin app.
 * Mobile collapses the anchor nav behind a toggle; the primary CTAs stay visible.
 */
const NAV = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Verticals", href: "#verticals" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-text-on-accent">
            <Icon name="leaf" size={16} aria-hidden />
          </span>
          <span className="font-display text-lg text-text-strong">Offshelf</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-text-muted transition-colors duration-fast hover:bg-surface-subtle hover:text-text-strong"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="hidden h-9 items-center rounded-md px-3 text-sm font-medium text-text transition-colors duration-fast hover:bg-surface-subtle sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-text-on-accent transition-colors duration-fast hover:bg-accent-hover"
          >
            Get started <Icon name="arrowRight" size={15} aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle navigation menu"
            className="grid h-9 w-9 place-items-center rounded-md border border-border text-text transition-colors duration-fast hover:bg-surface-subtle md:hidden"
          >
            <Icon name={open ? "x" : "list"} size={18} aria-hidden />
          </button>
        </div>
      </div>

      {/* Mobile anchor nav */}
      <div className={cx("border-t border-border md:hidden", open ? "block" : "hidden")}>
        <nav className="mx-auto flex max-w-[1120px] flex-col px-6 py-2" aria-label="Primary mobile">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 text-sm text-text transition-colors duration-fast hover:bg-surface-subtle"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/sign-in"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2.5 text-sm text-text transition-colors duration-fast hover:bg-surface-subtle sm:hidden"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
