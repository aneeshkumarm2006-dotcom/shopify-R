import { PageHeader, Skeleton, SkeletonRows } from "@/components/ui";

/**
 * Route-level loading skeletons (Stage 14 — DESIGN §3.9: every list/detail has a
 * loading state, and it mirrors the final layout rather than a full-page spinner).
 * These back the App Router `loading.tsx` Suspense fallbacks; they render inside the
 * admin chrome's centered content column, so they only draw the page body.
 */

/** Index-list fallback: page header + a card of shimmering table rows. */
export function ListLoading({
  title,
  rows = 6,
  cols = 5,
}: {
  title: string;
  rows?: number;
  cols?: number;
}) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="card" style={{ overflow: "hidden", padding: 0 }}>
        <SkeletonRows rows={rows} cols={cols} />
      </div>
    </div>
  );
}

/** Detail fallback: header + a two-column body of stacked skeleton blocks. */
export function StatLoading({ title, stats = 4 }: { title: string; stats?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <PageHeader title={title} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${stats}, minmax(0, 1fr))`,
          gap: "var(--space-4)",
          marginBottom: "var(--space-5)",
        }}
      >
        {Array.from({ length: stats }).map((_, i) => (
          <div key={i} className="card" style={{ display: "grid", gap: "var(--space-2)" }}>
            <Skeleton height={13} width="55%" />
            <Skeleton height={28} width="70%" />
            <Skeleton height={12} width="40%" />
          </div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: "var(--space-5)",
        }}
      >
        <div className="card" style={{ display: "grid", gap: "var(--space-3)" }}>
          <Skeleton height={16} width="35%" />
          <Skeleton height={160} />
        </div>
        <div className="card" style={{ display: "grid", gap: "var(--space-3)" }}>
          <Skeleton height={16} width="50%" />
          <Skeleton height={14} width="90%" />
          <Skeleton height={14} width="75%" />
          <Skeleton height={14} width="80%" />
        </div>
      </div>
    </div>
  );
}

/** Detail fallback: header + a two-column body of stacked skeleton blocks. */
export function DetailLoading({ title }: { title: string }) {
  return (
    <div role="status" aria-label="Loading">
      <PageHeader title={title} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: "var(--space-5)",
        }}
      >
        <div className="card" style={{ display: "grid", gap: "var(--space-3)" }}>
          <Skeleton height={20} width="40%" />
          <Skeleton height={120} />
          <Skeleton height={14} width="80%" />
          <Skeleton height={14} width="60%" />
        </div>
        <div className="card" style={{ display: "grid", gap: "var(--space-3)" }}>
          <Skeleton height={16} width="50%" />
          <Skeleton height={14} width="90%" />
          <Skeleton height={14} width="70%" />
        </div>
      </div>
    </div>
  );
}
