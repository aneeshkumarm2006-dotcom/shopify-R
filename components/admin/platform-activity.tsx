import Link from "next/link";
import type { EventFeed } from "@/lib/data";
import type { PlatformEvent } from "@/types";
import { EVENT_TYPES } from "@/types";
import {
  cx,
  Eyebrow,
  Icon,
  PageHeader,
  Pill,
  type IconName,
  type PillTone,
} from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

/**
 * Platform operator Activity feed (Stage 14, DESIGN §4.12) — a cross-tenant,
 * read-only timeline of every recorded merchant/operator action. Rows resolve the
 * id-only event docs to human labels (actor email · store name · target) using the
 * lookup maps the server already built. Filtering is server-driven via `?type=`
 * links — no client state. Metadata-only by contract; never renders shopper PII.
 */

type Category = "lifecycle" | "catalog" | "order" | "billing" | "settings" | "auth";

const CATEGORY_TONE: Record<Category, PillTone> = {
  lifecycle: "info",
  catalog: "muted",
  order: "success",
  billing: "warning",
  settings: "muted",
  auth: "muted",
};

interface TypeMeta {
  label: string;
  icon: IconName;
  category: Category;
}

/** Friendly label · icon · category for every canonical event type. */
const TYPE_META: Record<string, TypeMeta> = {
  "auth.login": { label: "Signed in", icon: "user", category: "auth" },
  "account.first_provision": {
    label: "Account provisioned",
    icon: "sparkle",
    category: "lifecycle",
  },
  "store.created": { label: "Store created", icon: "store", category: "lifecycle" },
  "store.published": { label: "Store published", icon: "store", category: "lifecycle" },
  "store.unpublished": {
    label: "Store unpublished",
    icon: "store",
    category: "lifecycle",
  },
  "store.suspended": { label: "Store suspended", icon: "lock", category: "lifecycle" },
  "store.reinstated": {
    label: "Store reinstated",
    icon: "refresh",
    category: "lifecycle",
  },
  "subdomain.claimed": {
    label: "Subdomain claimed",
    icon: "link",
    category: "lifecycle",
  },
  "plan.changed": { label: "Plan changed", icon: "tag", category: "billing" },
  "product.created": { label: "Product created", icon: "products", category: "catalog" },
  "product.updated": { label: "Product updated", icon: "products", category: "catalog" },
  "product.deleted": { label: "Product deleted", icon: "trash", category: "catalog" },
  "product.status_changed": {
    label: "Product status changed",
    icon: "products",
    category: "catalog",
  },
  "collection.created": {
    label: "Collection created",
    icon: "layers",
    category: "catalog",
  },
  "collection.updated": {
    label: "Collection updated",
    icon: "layers",
    category: "catalog",
  },
  "collection.deleted": {
    label: "Collection deleted",
    icon: "trash",
    category: "catalog",
  },
  "inventory.adjusted": {
    label: "Inventory adjusted",
    icon: "inventory",
    category: "catalog",
  },
  "discount.created": { label: "Discount created", icon: "tag", category: "catalog" },
  "discount.updated": { label: "Discount updated", icon: "tag", category: "catalog" },
  "discount.deleted": { label: "Discount deleted", icon: "trash", category: "catalog" },
  "order.status_changed": {
    label: "Order status changed",
    icon: "orders",
    category: "order",
  },
  "order.fulfilled": { label: "Order fulfilled", icon: "truck", category: "order" },
  "settings.updated": {
    label: "Settings updated",
    icon: "settings",
    category: "settings",
  },
  "settings.code_injection_changed": {
    label: "Code injection changed",
    icon: "code",
    category: "settings",
  },
};

const FALLBACK_META: TypeMeta = { label: "Activity", icon: "info", category: "settings" };

function metaFor(type: string): TypeMeta {
  return TYPE_META[type] ?? { ...FALLBACK_META, label: humanize(type) };
}

/** Turn an unknown `some.event_type` into a readable "Some event type". */
function humanize(type: string): string {
  const words = type.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Resolve the acting party to a display string. */
function actorLabel(event: PlatformEvent, actorEmails: Record<string, string>): string {
  if (event.actorType === "system") return "System";
  if (event.actorType === "platform_admin") {
    const email = event.actorUserId ? actorEmails[event.actorUserId] : undefined;
    return email ? `${email} (operator)` : "Operator";
  }
  if (event.actorUserId) {
    return actorEmails[event.actorUserId] ?? `user ${event.actorUserId.slice(-6)}`;
  }
  return "Unknown";
}

/**
 * Distill metadata into one short muted line. Only renders the common, safe shapes
 * we expect (`from → to`, `plan`, named scalars) — anything unexpected is skipped
 * rather than dumped, so a surprise field can never leak into the UI.
 */
function metadataSummary(metadata?: Record<string, unknown>): string | null {
  if (!metadata) return null;
  const parts: string[] = [];
  const from = scalar(metadata.from);
  const to = scalar(metadata.to);
  if (from != null || to != null) {
    parts.push(`${from ?? "—"} → ${to ?? "—"}`);
  }
  for (const key of ["plan", "status", "code", "amount", "quantity"]) {
    if (key in metadata) {
      const v = scalar(metadata[key]);
      if (v != null) parts.push(`${key}: ${v}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Coerce only primitive scalars to a display string; reject objects/arrays. */
function scalar(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

/** Build the type-filter chips: All + only the types actually present in the feed. */
function presentTypes(events: PlatformEvent[]): string[] {
  const seen = new Set(events.map((e) => e.type));
  // Keep the canonical ordering, then append any unknown types that slipped in.
  const ordered = (EVENT_TYPES as readonly string[]).filter((t) => seen.has(t));
  const extras = [...seen].filter((t) => !(EVENT_TYPES as readonly string[]).includes(t));
  return [...ordered, ...extras];
}

function hrefForType(type: string | null): string {
  return type ? `/platform/activity?type=${encodeURIComponent(type)}` : "/platform/activity";
}

export function PlatformActivity({
  feed,
  activeType,
}: {
  feed: EventFeed;
  activeType?: string;
}) {
  const { events, storeNames, actorEmails } = feed;
  const types = presentTypes(events);

  return (
    <div>
      <PageHeader
        title="Activity"
        meta="Cross-tenant operator log — read-only. Metadata only; no shopper data."
      />

      <div
        role="group"
        aria-label="Filter by event type"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          marginBottom: "var(--space-4)",
        }}
      >
        <Link
          href={hrefForType(null)}
          className={cx("viewtab", !activeType && "active")}
          aria-current={!activeType ? "true" : undefined}
        >
          All
        </Link>
        {types.map((t) => (
          <Link
            key={t}
            href={hrefForType(t)}
            className={cx("viewtab", activeType === t && "active")}
            aria-current={activeType === t ? "true" : undefined}
          >
            {metaFor(t).label}
          </Link>
        ))}
      </div>

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>
          {events.length} {events.length === 1 ? "event" : "events"}
          {activeType ? ` · ${metaFor(activeType).label}` : ""}
        </Eyebrow>
      </div>

      {events.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "var(--space-6) var(--space-5)",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          No activity yet.
        </div>
      ) : (
        <ul className="card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {events.map((event, i) => (
            <ActivityRow
              key={event._id}
              event={event}
              storeNames={storeNames}
              actorEmails={actorEmails}
              first={i === 0}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityRow({
  event,
  storeNames,
  actorEmails,
  first,
}: {
  event: PlatformEvent;
  storeNames: Record<string, string>;
  actorEmails: Record<string, string>;
  first: boolean;
}) {
  const meta = metaFor(event.type);
  const actor = actorLabel(event, actorEmails);
  const storeName = event.storeId ? storeNames[event.storeId] : undefined;
  const targetLabel = event.target?.label;
  const summary = metadataSummary(event.metadata ?? undefined);

  return (
    <li
      style={{
        display: "flex",
        gap: "var(--space-3)",
        padding: "var(--space-4) var(--space-5)",
        borderTop: first ? "none" : "var(--border-w) solid var(--border)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: "var(--radius-md)",
          background: "var(--surface-sunken)",
          color: "var(--text-muted)",
        }}
      >
        <Icon name={meta.icon} size={16} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>
            {meta.label}
          </span>
          <Pill tone={CATEGORY_TONE[meta.category]} dot={false}>
            {meta.category}
          </Pill>
          {targetLabel && (
            <span style={{ color: "var(--text)", fontSize: "var(--text-sm)" }}>
              {targetLabel}
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-2)",
            marginTop: 4,
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
          }}
        >
          <span>{actor}</span>
          {storeName && (
            <>
              <span aria-hidden="true">·</span>
              <span>{storeName}</span>
            </>
          )}
          {summary && (
            <>
              <span aria-hidden="true">·</span>
              <span className="mono">{summary}</span>
            </>
          )}
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          textAlign: "right",
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        <time dateTime={event.createdAt}>{fmtDateTime(event.createdAt)}</time>
        {event.ip && (
          <div className="mono" style={{ fontSize: "var(--text-2xs)", marginTop: 2 }}>
            {event.ip}
          </div>
        )}
      </div>
    </li>
  );
}
