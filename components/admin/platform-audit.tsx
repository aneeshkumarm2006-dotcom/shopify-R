import type { PlatformEvent } from "@/types";
import { Eyebrow, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

/**
 * Platform operator Audit log (operator P2) — a read-only trail of operator-initiated
 * actions (suspensions, reinstatements, impersonations, plan changes). Distinct from
 * the merchant Activity feed: this is the "who did what" record for accountability.
 * Metadata-only by contract — never renders shopper PII.
 */

/** Friendly action labels for the operator action types we expect. */
const ACTION_LABEL: Record<string, string> = {
  "store.suspended": "Suspended store",
  "store.reinstated": "Reinstated store",
  "impersonation.started": "Started impersonation",
  "impersonation.ended": "Ended impersonation",
  "plan.changed": "Changed plan",
};

/** Turn an unknown `some.event_type` into a readable "Some event type". */
function humanize(type: string): string {
  const words = type.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function actionLabel(type: string): string {
  return ACTION_LABEL[type] ?? humanize(type);
}

/** Short, non-identifying handle for an operator id (last 6 chars). */
function shortActor(id?: string | null): string | null {
  if (!id) return null;
  return id.length > 6 ? `…${id.slice(-6)}` : id;
}

export function PlatformAudit({ events }: { events: PlatformEvent[] }) {
  return (
    <div>
      <PageHeader
        title="Audit log"
        meta="Operator actions across all tenants — read-only accountability trail."
      />

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>
          {events.length} {events.length === 1 ? "action" : "actions"}
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
          No operator actions yet.
        </div>
      ) : (
        <ul className="card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {events.map((event, i) => (
            <AuditRow key={event._id} event={event} first={i === 0} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AuditRow({ event, first }: { event: PlatformEvent; first: boolean }) {
  const label = actionLabel(event.type);
  const targetLabel = event.target?.label ?? event.target?.id ?? null;
  const actor = shortActor(event.actorUserId);

  return (
    <li
      style={{
        display: "flex",
        gap: "var(--space-3)",
        padding: "var(--space-4) var(--space-5)",
        borderTop: first ? "none" : "var(--border-w) solid var(--border)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>{label}</span>
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
          {actor && <span className="mono">operator {actor}</span>}
          {event.ip && (
            <>
              {actor && <span aria-hidden="true">·</span>}
              <span className="mono">{event.ip}</span>
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
      </div>
    </li>
  );
}
