"use client";

import Link from "next/link";
import type { Section } from "@/types";
import { StoreLogo } from "@/components/storefront/store-logo";
import { useStoreHref } from "@/components/storefront/storefront-context";

interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}
interface FooterSettings {
  tagline?: string;
  columns?: FooterColumn[];
  legal?: string;
}

/**
 * Storefront footer (DESIGN §5.2) — brand + tagline, link columns, and a fine-print
 * compliance line. The (static) newsletter capture lives as its own section in the
 * home template; the footer keeps a generic, processor-neutral payment note.
 */
export function StoreFooter({
  section,
  preview = false,
  storeName,
}: {
  section: Section;
  preview?: boolean;
  storeName?: string;
}) {
  const s = section.settings as FooterSettings;
  const columns = s.columns ?? [];
  const href = useStoreHref();

  const LinkEl = ({ href: to, children }: { href: string; children: string }) =>
    preview ? (
      <span style={{ fontSize: "var(--text-base)", color: "var(--warm-600)" }}>{children}</span>
    ) : (
      <Link href={href(to)} style={{ fontSize: "var(--text-base)", color: "var(--warm-600)" }}>
        {children}
      </Link>
    );

  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--warm-0)",
        marginTop: "var(--space-12)",
      }}
    >
      <div
        className="store-container store-footer-cols"
        style={{ paddingTop: "var(--space-16)", paddingBottom: "var(--space-10)" }}
      >
        <div>
          <StoreLogo name={storeName} />
          {s.tagline && (
            <p
              style={{
                marginTop: "var(--space-4)",
                fontSize: "var(--text-base)",
                color: "var(--warm-600)",
                lineHeight: 1.6,
                maxWidth: 280,
              }}
            >
              {s.tagline}
            </p>
          )}
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <div
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: "var(--warm-900)",
                marginBottom: "var(--space-4)",
              }}
            >
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
      </div>
      {s.legal && (
        <div
          className="store-container"
          style={{
            paddingTop: "var(--space-5)",
            paddingBottom: "var(--space-5)",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--space-3)",
            fontSize: "var(--text-xs)",
            color: "var(--warm-500)",
          }}
        >
          <span>{s.legal}</span>
          <span>Lab-tested · Payment arranged securely · Licensed</span>
        </div>
      )}
    </footer>
  );
}
