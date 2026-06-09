import Link from "next/link";
import { Icon } from "@/components/ui/icon";

/**
 * Marketing footer (Stage 5) — Offshelf's own apex-site footer. Four link columns,
 * a compliance fine-print line, and a clearly-marked placeholder note (final brand
 * copy is pending user input — see TODO "Needs user input").
 */
const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Store builder", href: "#features" },
      { label: "Inventory", href: "#features" },
      { label: "Compliance", href: "#trust" },
      { label: "Sign in", href: "/sign-in" },
    ],
  },
  {
    title: "Verticals",
    links: [
      { label: "Vape", href: "#verticals" },
      { label: "Cannabis", href: "#verticals" },
      { label: "CBD", href: "#verticals" },
      { label: "Other restricted", href: "#verticals" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface-subtle">
      <div className="mx-auto max-w-[1120px] px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-text-on-accent">
                <Icon name="leaf" size={16} aria-hidden />
              </span>
              <span className="font-display text-lg text-text-strong">Offshelf</span>
            </Link>
            <p className="mt-4 max-w-[28ch] text-sm leading-relaxed text-text-muted">
              The store platform for businesses everyone else bans. Build, manage, and
              publish a compliant storefront — without DevOps.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="mb-4 text-sm font-semibold text-text-strong">{col.title}</div>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-text-muted transition-colors duration-fast hover:text-text-strong"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Offshelf. 21+ only. Sell responsibly and within your local laws.</span>
          <span className="mono">Built for high-risk verticals · Payment seams ready</span>
        </div>

        {/* Acceptance: copy is clearly marked placeholder (TODO "Needs user input"). */}
        <p className="mt-4 text-2xs text-text-muted/70">
          Placeholder marketing copy &amp; brand content — pending final messaging, brand
          confirmation, pricing, and imagery from the product owner.
        </p>
      </div>
    </footer>
  );
}
