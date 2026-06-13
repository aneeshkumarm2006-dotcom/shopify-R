import Link from "next/link";
import type { PlatformSearchHit } from "@/types";
import { Eyebrow, PageHeader } from "@/components/ui";

/**
 * Platform operator global search (operator P2) — cross-tenant results grouped by kind.
 * Driven entirely by `?q=` from the shell header search box; no client state. Hit hrefs
 * come from the API (untrusted), so we only follow same-origin app paths — anything
 * else (external URL, `javascript:`) is rendered as inert text, never a link.
 */

const KIND_ORDER = ["store", "user", "order", "product"] as const;
type Kind = (typeof KIND_ORDER)[number];

const KIND_LABEL: Record<Kind, string> = {
  store: "Stores",
  user: "Users",
  order: "Orders",
  product: "Products",
};

/** Allow only internal, same-origin paths in hrefs (block `javascript:`, external). */
function safeHref(href: string): string | null {
  return href.startsWith("/") && !href.startsWith("//") ? href : null;
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="card"
      style={{
        padding: "var(--space-6) var(--space-5)",
        textAlign: "center",
        color: "var(--text-muted)",
        fontSize: "var(--text-sm)",
      }}
    >
      {children}
    </div>
  );
}

export function PlatformSearch({
  query,
  hits,
}: {
  query?: string;
  hits: PlatformSearchHit[];
}) {
  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: hits.filter((h) => h.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <PageHeader
        title="Search"
        meta="Cross-tenant search — stores, users, orders, and products across all tenants."
      />

      {!query ? (
        <EmptyCard>Type to search across all tenants.</EmptyCard>
      ) : hits.length === 0 ? (
        <EmptyCard>No matches for &ldquo;{query}&rdquo;.</EmptyCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {grouped.map((group) => (
            <section key={group.kind}>
              <div style={{ marginBottom: "var(--space-3)" }}>
                <Eyebrow>{KIND_LABEL[group.kind]}</Eyebrow>
              </div>
              <ul className="card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {group.items.map((hit, i) => (
                  <HitRow key={`${hit.kind}-${hit.id}`} hit={hit} first={i === 0} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function HitRow({ hit, first }: { hit: PlatformSearchHit; first: boolean }) {
  const href = safeHref(hit.href);

  const body = (
    <>
      <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>{hit.label}</span>
      {hit.sub && (
        <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
          {hit.sub}
        </span>
      )}
    </>
  );

  const style: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "var(--space-3) var(--space-5)",
    borderTop: first ? "none" : "var(--border-w) solid var(--border)",
  };

  return (
    <li>
      {href ? (
        <Link href={href} style={{ ...style, textDecoration: "none" }}>
          {body}
        </Link>
      ) : (
        <div style={style}>{body}</div>
      )}
    </li>
  );
}
