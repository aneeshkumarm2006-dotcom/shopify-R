import type { ReactNode } from "react";
import Link from "next/link";
import type { PlatformTraffic, TrafficPoint } from "@/types";
import { Card, Eyebrow, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";

/**
 * Platform operator Traffic (operator P4) — cross-tenant storefront visitor
 * analytics rolled up from `getPlatformTraffic()`. Read-only, point-in-time:
 * total views / unique sessions over the window, a pure-CSS 30-day bar chart,
 * and the busiest stores. No chart library — bars are token-styled divs.
 */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="stat-label">{label}</div>
      <div className="stat-value mono">{value}</div>
    </Card>
  );
}

/**
 * Pure-CSS daily bar chart. Each bar's height is proportional to that day's
 * views against the busiest day; the native `title` carries the exact count so
 * the chart stays keyboard- and screen-reader-reachable without extra markup.
 * A few evenly spaced date labels anchor the x-axis.
 */
export function TrafficBars({
  byDay,
  height = 96,
}: {
  byDay: TrafficPoint[];
  height?: number;
}) {
  if (byDay.length === 0) return null;
  const max = Math.max(1, ...byDay.map((d) => d.views));
  // Roughly five evenly spaced ticks across the range.
  const step = Math.max(1, Math.ceil(byDay.length / 5));

  return (
    <div>
      <div
        role="img"
        aria-label={`Daily storefront views over the last ${byDay.length} days`}
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 3,
          height,
        }}
      >
        {byDay.map((d) => {
          const pct = Math.round((d.views / max) * 100);
          return (
            <div
              key={d.date}
              title={`${fmtDate(d.date)} · ${d.views.toLocaleString()} views`}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "flex-end",
                height: "100%",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(d.views > 0 ? 4 : 2, pct)}%`,
                  borderRadius: "var(--radius-sm)",
                  background:
                    d.views > 0 ? "var(--accent)" : "var(--surface-sunken)",
                  opacity: d.views > 0 ? 0.85 : 1,
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "var(--space-2)",
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
        }}
      >
        {byDay
          .filter((_, i) => i % step === 0 || i === byDay.length - 1)
          .map((d) => (
            <span key={d.date}>{fmtDate(d.date)}</span>
          ))}
      </div>
    </div>
  );
}

const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "var(--space-4)",
  marginBottom: "var(--space-5)",
};

function EmptyTraffic(): ReactNode {
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
      No storefront traffic recorded yet — the pageview beacon records visits to
      live stores from now on.
    </div>
  );
}

export function PlatformTraffic({ traffic }: { traffic: PlatformTraffic }) {
  return (
    <div>
      <PageHeader
        title="Traffic"
        meta="Cross-tenant storefront visitor analytics — last 30 days, read-only."
      />

      {traffic.totalViews === 0 ? (
        <EmptyTraffic />
      ) : (
        <>
          <div style={GRID}>
            <StatCard
              label="Total views · 30d"
              value={traffic.totalViews.toLocaleString()}
            />
            <StatCard
              label="Unique sessions · 30d"
              value={traffic.totalSessions.toLocaleString()}
            />
          </div>

          <Card title="Views per day · last 30 days" style={{ marginBottom: "var(--space-5)" }}>
            <TrafficBars byDay={traffic.byDay} height={120} />
          </Card>

          <div style={{ marginBottom: "var(--space-3)" }}>
            <Eyebrow>Top stores by traffic</Eyebrow>
          </div>
          <Card pad={false}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Store</th>
                  <th style={{ ...th, ...numCol }}>Views</th>
                  <th style={{ ...th, ...numCol }}>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {traffic.topStores.map((s) => (
                  <tr key={s.storeId}>
                    <td style={td}>
                      <Link
                        href={`/platform/stores/${s.storeId}`}
                        style={{ color: "var(--text-strong)", fontWeight: 500 }}
                      >
                        {s.storeName}
                      </Link>
                    </td>
                    <td style={{ ...td, ...numCol }} className="mono">
                      {s.views.toLocaleString()}
                    </td>
                    <td style={{ ...td, ...numCol }} className="mono">
                      {s.sessions.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "var(--space-3) var(--space-5)",
  fontSize: "var(--text-xs)",
  fontWeight: 500,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "var(--border-w) solid var(--border)",
};

const td: React.CSSProperties = {
  padding: "var(--space-3) var(--space-5)",
  fontSize: "var(--text-sm)",
  color: "var(--text-strong)",
  borderBottom: "var(--border-w) solid var(--border)",
};

const numCol: React.CSSProperties = {
  textAlign: "right",
  whiteSpace: "nowrap",
};
