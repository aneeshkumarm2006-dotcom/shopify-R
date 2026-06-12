import Link from "next/link";
import type { MisalignedStore } from "@/lib/data";
import { Eyebrow, Icon, PageHeader, Pill } from "@/components/ui";
import { storeStatusPill } from "@/components/admin/shared";
import {
  bySeverity,
  HealthCheckRow,
  SEVERITY_LABEL,
  SEVERITY_TONE,
  worstSeverity,
} from "@/components/admin/platform-health-shared";
import { storeDomain } from "@/lib/format";

/**
 * Platform operator Health (Stage 14, DESIGN §4.12) — every store failing one or
 * more alignment checks, sorted by worst severity then failing count. Each row links
 * to the operator store-detail view and lists its failing checks inline. Read-only;
 * the rules run server-side. Empty state means every store is in a proper config.
 */
export function PlatformHealth({ stores }: { stores: MisalignedStore[] }) {
  const sorted = [...stores].sort(bySeverity);

  return (
    <div>
      <PageHeader
        title="Health"
        meta="Stores failing one or more alignment checks — sorted by severity."
      />

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>
          {sorted.length} {sorted.length === 1 ? "store" : "stores"} need attention
        </Eyebrow>
      </div>

      {sorted.length === 0 ? (
        <div
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "var(--space-6) var(--space-5)",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          <Icon name="check" size={22} aria-hidden style={{ color: "var(--success)" }} />
          All stores look aligned.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {sorted.map((s) => {
            const pill = storeStatusPill(s.status);
            const worst = worstSeverity(s.failing);
            return (
              <div key={s.id} className="card" style={{ overflow: "hidden" }}>
                <div
                  className="card-header"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <Link
                    href={`/platform/stores/${s.id}`}
                    style={{
                      fontWeight: 600,
                      color: "var(--text-strong)",
                      textDecoration: "none",
                    }}
                  >
                    {s.name}
                  </Link>
                  <span className="mono" style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
                    {storeDomain(s.subdomain)}
                  </span>
                  <Pill tone={pill.tone}>{pill.label}</Pill>
                  <span style={{ marginLeft: "auto", display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <Pill tone={SEVERITY_TONE[worst]} dot={false}>
                      {SEVERITY_LABEL[worst]}
                    </Pill>
                    <Pill tone="muted" dot={false}>
                      {s.failing.length} failing
                    </Pill>
                  </span>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {s.failing.map((c, i) => (
                    <HealthCheckRow key={c.id} check={c} first={i === 0} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
