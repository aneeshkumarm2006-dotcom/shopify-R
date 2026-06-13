import type { StoreTraffic } from "@/types";
import { Card } from "@/components/ui";
import { TrafficBars } from "@/components/admin/platform-traffic";

/**
 * Compact, read-only traffic snapshot for one store (operator P4) — a leaner
 * inline counterpart to the platform-wide Traffic screen. Views + sessions over
 * the window, the same pure-CSS daily bar chart, and the busiest storefront
 * paths. Paths are store-owned strings (not shopper PII), rendered as text only.
 */
export function PlatformStoreTraffic({ traffic }: { traffic: StoreTraffic }) {
  if (traffic.views === 0) {
    return (
      <Card title="Storefront traffic · 30d">
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          No traffic yet.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Storefront traffic · 30d">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-4)",
          marginBottom: "var(--space-4)",
        }}
      >
        <div>
          <div className="stat-label">Views</div>
          <div className="stat-value mono">{traffic.views.toLocaleString()}</div>
        </div>
        <div>
          <div className="stat-label">Sessions</div>
          <div className="stat-value mono">
            {traffic.sessions.toLocaleString()}
          </div>
        </div>
      </div>

      <TrafficBars byDay={traffic.byDay} height={72} />

      {traffic.topPaths.length > 0 && (
        <div style={{ marginTop: "var(--space-5)" }}>
          <div
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 500,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "var(--space-2)",
            }}
          >
            Top paths
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {traffic.topPaths.map((p, i) => (
              <li
                key={p.path}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  padding: "var(--space-2) 0",
                  borderTop:
                    i === 0 ? "none" : "var(--border-w) solid var(--border)",
                  fontSize: "var(--text-sm)",
                }}
              >
                <span
                  className="mono"
                  style={{
                    color: "var(--text-strong)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.path}
                </span>
                <span
                  className="mono"
                  style={{ color: "var(--text-muted)", flexShrink: 0 }}
                >
                  {p.views.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
