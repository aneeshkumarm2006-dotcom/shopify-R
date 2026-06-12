import type { PlatformKpis, PlatformUserSummary } from "@/types";
import { Card, Eyebrow, Icon, PageHeader, Pill } from "@/components/ui";

/**
 * Platform operator Billing (Stage 14, DESIGN §4.12) — reporting-only. There's no
 * real billing pipeline (subscriptions are manually provisioned, PRD §5.10), so this
 * surfaces the plan mix from the KPIs plus the list of accounts on the Standard plan.
 * No charges, invoices, or processor actions are shown.
 */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="stat-label">{label}</div>
      <div className="stat-value mono">{value}</div>
    </Card>
  );
}

export function PlatformBilling({
  kpis,
  users,
}: {
  kpis: PlatformKpis;
  users: PlatformUserSummary[];
}) {
  const standardUsers = users.filter((u) => u.plan === "standard");
  const planTotal = kpis.freePlan + kpis.standardPlan;
  const standardPct =
    planTotal > 0 ? Math.round((kpis.standardPlan / planTotal) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Billing"
        meta="Plan reporting only — subscriptions are manually provisioned (billing is stubbed)."
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)",
          background: "var(--surface-sunken)",
          border: "var(--border-w) solid var(--border)",
          borderRadius: "var(--radius-lg)",
          marginBottom: "var(--space-5)",
          fontSize: "var(--text-sm)",
          color: "var(--text-muted)",
        }}
      >
        <Icon name="info" size={16} aria-hidden style={{ flexShrink: 0 }} />
        <span>
          Reporting view. No payment processor is wired — plans are set by operators and
          surfaced here for visibility.
        </span>
      </div>

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>Plan mix</Eyebrow>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
        }}
      >
        <StatCard label="Free plan" value={String(kpis.freePlan)} />
        <StatCard label="Standard plan" value={String(kpis.standardPlan)} />
        <StatCard label="Standard share" value={`${standardPct}%`} />
      </div>

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>
          {standardUsers.length} {standardUsers.length === 1 ? "account" : "accounts"} on
          Standard
        </Eyebrow>
      </div>

      {standardUsers.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "var(--space-6) var(--space-5)",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          No accounts on the Standard plan yet.
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Name</th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Stores
                  </th>
                  <th scope="col">Plan</th>
                </tr>
              </thead>
              <tbody>
                {standardUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="mono" style={{ color: "var(--text-strong)" }}>
                        {u.email}
                      </span>
                    </td>
                    <td>{u.name}</td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      {u.storeCount}
                    </td>
                    <td>
                      <Pill tone="info" dot={false}>
                        Standard
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
