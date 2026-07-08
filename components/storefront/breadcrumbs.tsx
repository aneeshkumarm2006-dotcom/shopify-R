"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { useStoreHref } from "./storefront-context";
import { STORE_HOME } from "./shared";

export interface Crumb {
  label: string;
  /** Store-relative path. Omit for the current (last) page. */
  href?: string;
}

/**
 * Storefront breadcrumb trail (Home › … › current). Always prepends Home, renders the
 * last crumb as static current-page text, and links the rest via the tenant href
 * helper. Mirrors the admin breadcrumb visual, purpose-built for the customer chrome.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const href = useStoreHref();
  const all: Crumb[] = [{ label: "Home", href: STORE_HOME }, ...items];
  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: "var(--space-6)" }}>
      <ol
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
          listStyle: "none",
          padding: 0,
          margin: 0,
          fontSize: "var(--text-sm)",
        }}
      >
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <li key={`${c.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {c.href && !last ? (
                <Link href={href(c.href)} style={{ color: "var(--warm-600)" }}>
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  style={{
                    color: last ? "var(--text-strong)" : "var(--warm-500)",
                    fontWeight: last ? 500 : 400,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: last ? 260 : undefined,
                  }}
                >
                  {c.label}
                </span>
              )}
              {!last && <Icon name="chevronRight" size={14} aria-hidden style={{ color: "var(--warm-400)" }} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
