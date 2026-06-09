import localFont from "next/font/local";

/**
 * Self-hosted fonts (DESIGN §2.3), loaded via `next/font/local` and exposed as
 * the CSS variables the token layer expects:
 *   --font-ui       Geist            (UI / body)
 *   --font-mono     Geist Mono       (numbers, SKUs, code)
 *   --font-display  Clash Display    (storefront H1/H2/hero only)
 *
 * Geist + Geist Mono are single variable files; Clash Display ships per-weight.
 * Apply all three `.variable` classNames on <html> in the root layout.
 */

export const fontUi = localFont({
  src: [{ path: "./fonts/Geist-Variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-ui",
  display: "swap",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
});

export const fontMono = localFont({
  src: [{ path: "./fonts/GeistMono-Variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-mono",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

export const fontDisplay = localFont({
  src: [
    { path: "./fonts/ClashDisplay-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ClashDisplay-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ClashDisplay-Semibold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ClashDisplay-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["Geist", "sans-serif"],
});
