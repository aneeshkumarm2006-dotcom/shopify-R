import Link from "next/link";
import type { ReactNode } from "react";
import type { StoreOperatorDetail } from "@/types";
import type { EventFeed } from "@/lib/data";
import { Card, Eyebrow, Icon, PageHeader, Pill } from "@/components/ui";
import { storeStatusPill } from "@/components/admin/shared";
import { HealthCheckRow } from "@/components/admin/platform-health-shared";
import { StoreLifecycleControls } from "@/components/admin/platform-store-lifecycle";
import { fmtDate, fmtDateTime, storeDomain } from "@/lib/format";

/**
 * Operator store-detail (Stage 14, DESIGN §4.12) — a cross-tenant, read-only config
 * snapshot for one store: status/plan/address, age-gate + code-injection posture,
 * commerce counts, the full health-check list (failing emphasized), and the store's
 * activity timeline. The single mutation (suspend/reinstate) lives in a small client
 * child. Code-injection content is NEVER rendered — only a "present?" boolean.
 */

const SCRIPT_RE = /<script\b|javascript:/i;

function hasInjection(detail: StoreOperatorDetail): boolean {
  const ci = detail.store.codeInjection;
  return Boolean(
    ci.headHtml?.trim() ||
      ci.bodyHtml?.trim() ||
      ci.customCss?.trim() ||
      ci.customJs?.trim(),
  );
}

function hasInjectedScript(detail: StoreOperatorDetail): boolean {
  const ci = detail.store.codeInjection;
  return (
    SCRIPT_RE.test(ci.headHtml) ||
    SCRIPT_RE.test(ci.bodyHtml) ||
    SCRIPT_RE.test(ci.customJs)
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "var(--space-4)",
        padding: "var(--space-3) 0",
        borderTop: "var(--border-w) solid var(--border)",
        fontSize: "var(--text-sm)",
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: "var(--text-strong)", textAlign: "right" }}>{children}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="stat-label">{label}</div>
      <div className="stat-value mono">{value}</div>
    </Card>
  );
}

export function PlatformStoreDetail({
  detail,
  feed,
  notes,
  traffic,
}: {
  detail: StoreOperatorDetail;
  feed: EventFeed;
  notes?: ReactNode;
  traffic?: ReactNode;
}) {
  const { store } = detail;
  const pill = storeStatusPill(store.status);
  const injection = hasInjection(detail);
  const injectedScript = hasInjectedScript(detail);
  const failingCount = detail.health.filter((h) => !h.ok).length;

  return (
    <div>
      <PageHeader
        title={store.name}
        meta={
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Link href="/platform" style={{ color: "var(--text-muted)" }}>
              Stores
            </Link>
            <span aria-hidden="true">/</span>
            <span className="mono">{storeDomain(store.subdomain)}</span>
          </span>
        }
        actions={
          <StoreLifecycleControls
            subdomain={store.subdomain}
            storeName={store.name}
            status={store.status}
          />
        }
      />

      {/* Commerce counts */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-4)",
          marginBottom: "var(--space-5)",
        }}
      >
        <StatCard label="Products (active)" value={String(detail.productCount)} />
        <StatCard label="Orders" value={String(detail.orderCount)} />
        <StatCard label="Customers" value={String(detail.customerCount)} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-4)",
          alignItems: "start",
          marginBottom: "var(--space-5)",
        }}
      >
        {/* Config snapshot */}
        <Card title="Configuration">
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "var(--space-4)",
                padding: "var(--space-3) 0 var(--space-3)",
                fontSize: "var(--text-sm)",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>Status</span>
              <Pill tone={pill.tone}>{pill.label}</Pill>
            </div>
            <Row label="Owner">
              <span className="mono">{detail.ownerEmail}</span>
            </Row>
            <Row label="Address">
              <span className="mono">{storeDomain(store.subdomain)}</span>
            </Row>
            <Row label="Plan">
              <span style={{ textTransform: "capitalize" }}>{detail.plan}</span>
            </Row>
            <Row label="Age gate">
              {store.ageGate.enabled ? `On · ${store.ageGate.minAge}+` : "Off"}
            </Row>
            <Row label="Code injection present?">
              {injection ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    color: injectedScript ? "var(--critical)" : "var(--text-strong)",
                  }}
                >
                  Yes
                  {injectedScript && (
                    <Pill tone="critical" dot={false}>
                      script
                    </Pill>
                  )}
                </span>
              ) : (
                "No"
              )}
            </Row>
            <Row label="Created">{fmtDate(store.createdAt)}</Row>
            <Row label="First published">
              {store.publishedAt ? fmtDate(store.publishedAt) : "—"}
            </Row>
          </div>
        </Card>

        {/* Health checks */}
        <Card
          title={
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Health checks
              {failingCount > 0 ? (
                <Pill tone="critical" dot={false}>
                  {failingCount} failing
                </Pill>
              ) : (
                <Pill tone="success" dot={false}>
                  Aligned
                </Pill>
              )}
            </span>
          }
          pad={false}
        >
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {detail.health.map((c, i) => (
              <HealthCheckRow key={c.id} check={c} first={i === 0} />
            ))}
          </ul>
        </Card>
      </div>

      {/* Storefront traffic */}
      {traffic && <div style={{ marginBottom: "var(--space-5)" }}>{traffic}</div>}

      {/* Support notes */}
      {notes && <div style={{ marginBottom: "var(--space-5)" }}>{notes}</div>}

      {/* Timeline */}
      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>Store timeline</Eyebrow>
      </div>
      <StoreTimeline feed={feed} />
    </div>
  );
}

/**
 * Compact, read-only event timeline for one store. A leaner inline version of the
 * platform Activity feed — store name is implied by context, so each row is just the
 * action + actor + timestamp. Metadata-only by contract (no shopper PII).
 */
function StoreTimeline({ feed }: { feed: EventFeed }) {
  const { events, actorEmails } = feed;

  if (events.length === 0) {
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
        No recorded activity for this store.
      </div>
    );
  }

  return (
    <ul className="card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {events.map((event, i) => {
        const actor =
          event.actorType === "system"
            ? "System"
            : event.actorType === "platform_admin"
              ? event.actorUserId && actorEmails[event.actorUserId]
                ? `${actorEmails[event.actorUserId]} (operator)`
                : "Operator"
              : (event.actorUserId && actorEmails[event.actorUserId]) || "Merchant";
        const label = event.type.replace(/[._]/g, " ");
        return (
          <li
            key={event._id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              padding: "var(--space-3) var(--space-5)",
              borderTop: i === 0 ? "none" : "var(--border-w) solid var(--border)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                flexShrink: 0,
                borderRadius: "var(--radius-md)",
                background: "var(--surface-sunken)",
                color: "var(--text-muted)",
              }}
            >
              <Icon name="clock" size={14} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: 500,
                  color: "var(--text-strong)",
                  textTransform: "capitalize",
                }}
              >
                {label}
                {event.target?.label && (
                  <span
                    style={{
                      fontWeight: 400,
                      textTransform: "none",
                      color: "var(--text-muted)",
                    }}
                  >
                    {" · "}
                    {event.target.label}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                {actor}
              </div>
            </div>
            <time
              dateTime={event.createdAt}
              style={{
                flexShrink: 0,
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {fmtDateTime(event.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
