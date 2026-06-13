import type { ReactNode } from "react";
import type { EmailLogEntry, ServiceStatus, SystemHealth } from "@/types";
import { Eyebrow, PageHeader, Pill, type PillTone } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

/**
 * Platform operator System dashboard (operator P3) — a live, read-only snapshot of
 * the platform's own services plus the transactional email delivery log. Service
 * status is config + connectivity only; in this MVP most providers are unconfigured,
 * which is the expected calm "Not configured" state rather than an error.
 */

interface ServiceCard {
  key: keyof SystemHealth;
  label: string;
  status: ServiceStatus;
}

/** Resolve a service's status to a single {tone,label} pill. */
function servicePill(
  key: keyof SystemHealth,
  s: ServiceStatus,
): { tone: PillTone; label: string } {
  if (!s.configured) return { tone: "muted", label: "Not configured" };
  if (key === "db") {
    if (s.connected) {
      const ms = typeof s.latencyMs === "number" ? `${s.latencyMs}ms` : "—";
      return { tone: "success", label: `Connected · ${ms}` };
    }
    return { tone: "critical", label: "Down" };
  }
  return { tone: "success", label: "Configured" };
}

const SERVICE_LABEL: Record<keyof SystemHealth, string> = {
  db: "Database",
  email: "Email",
  payments: "Payments",
  billing: "Billing",
  auth: "Auth",
};

const SERVICE_HINT: Record<keyof SystemHealth, string> = {
  db: "Primary datastore + connectivity ping.",
  email: "Transactional email provider.",
  payments: "Storefront payment processor.",
  billing: "Platform billing provider.",
  auth: "OAuth + session secret.",
};

const ORDER: (keyof SystemHealth)[] = ["db", "email", "payments", "billing", "auth"];

const CARD_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: "var(--space-4)",
  marginBottom: "var(--space-6)",
};

/** First 8 chars of a store id, for a compact column. */
function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

/** Truncate a long error string for the log table. */
function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function PlatformSystem({
  health,
  emails,
}: {
  health: SystemHealth;
  emails: EmailLogEntry[];
}) {
  const services: ServiceCard[] = ORDER.map((key) => ({
    key,
    label: SERVICE_LABEL[key],
    status: health[key],
  }));

  return (
    <div>
      <PageHeader
        title="System"
        meta="Platform service status + transactional email log — read-only."
      />

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>Service status</Eyebrow>
      </div>
      <div style={CARD_GRID}>
        {services.map((svc) => {
          const pill = servicePill(svc.key, svc.status);
          return (
            <div key={svc.key} className="card" style={{ padding: "var(--space-4) var(--space-5)" }}>
              <div
                style={{
                  fontWeight: 600,
                  color: "var(--text-strong)",
                  marginBottom: "var(--space-3)",
                }}
              >
                {svc.label}
              </div>
              <Pill tone={pill.tone}>{pill.label}</Pill>
              <div
                style={{
                  marginTop: "var(--space-3)",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                }}
              >
                {SERVICE_HINT[svc.key]}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>
          Email delivery · {emails.length} {emails.length === 1 ? "message" : "messages"}
        </Eyebrow>
      </div>

      {emails.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "var(--space-6) var(--space-5)",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          No emails sent yet.
        </div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
            <thead>
              <tr>
                <Th>Recipient</Th>
                <Th>Subject</Th>
                <Th>Kind</Th>
                <Th>Status</Th>
                <Th>Store</Th>
                <Th>Sent</Th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e, i) => {
                const tone: PillTone = e.status === "sent" ? "success" : "critical";
                const label = e.status === "sent" ? "Sent" : "Failed";
                return (
                  <tr key={e._id} style={{ borderTop: i === 0 ? "none" : "var(--border-w) solid var(--border)" }}>
                    <Td>
                      <span className="mono">{e.to}</span>
                    </Td>
                    <Td>
                      <span style={{ color: "var(--text-strong)" }}>{e.subject}</span>
                      {e.status === "failed" && e.error && (
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: "var(--text-xs)",
                            color: "var(--critical)",
                          }}
                        >
                          {truncate(e.error)}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <span className="mono" style={{ color: "var(--text-muted)" }}>
                        {e.kind}
                      </span>
                    </Td>
                    <Td>
                      <Pill tone={tone} dot={false}>
                        {label}
                      </Pill>
                    </Td>
                    <Td>
                      {e.storeId ? (
                        <span className="mono" style={{ color: "var(--text-muted)" }}>
                          {shortId(e.storeId)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </Td>
                    <Td>
                      <time
                        dateTime={e.createdAt}
                        style={{ whiteSpace: "nowrap", color: "var(--text-muted)" }}
                      >
                        {fmtDateTime(e.createdAt)}
                      </time>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "var(--space-3) var(--space-4)",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return (
    <td style={{ padding: "var(--space-3) var(--space-4)", verticalAlign: "top" }}>{children}</td>
  );
}
