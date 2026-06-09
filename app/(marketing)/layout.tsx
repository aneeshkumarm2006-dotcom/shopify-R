import type { Metadata } from "next";

/**
 * Marketing route group (Stage 5) — Offshelf's own apex-domain site. Inherits the
 * root layout's ThemeProvider + fonts; this layout only sets apex-specific metadata.
 */
export const metadata: Metadata = {
  title: "Offshelf — The store platform for businesses everyone else bans",
  description:
    "Offshelf is a Shopify-style commerce platform built for vape, cannabis, and CBD merchants — a store builder, real inventory and orders, a 21+ age gate, and a payment layer designed for high-risk verticals.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
