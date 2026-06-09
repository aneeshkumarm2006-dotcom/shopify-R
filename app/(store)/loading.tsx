import { Skeleton } from "@/components/ui";

/**
 * Storefront loading fallback (Stage 14 — DESIGN §3.9). One group-level skeleton
 * covers every storefront page (home, collection, product, cart) while its data
 * resolves; it renders inside the store shell, so the header/age-gate stay in place.
 */
export default function StoreLoading() {
  return (
    <div
      className="store-container"
      role="status"
      aria-label="Loading"
      style={{ paddingTop: "var(--space-12)", paddingBottom: "var(--space-16)", display: "grid", gap: "var(--space-5)" }}
    >
      <Skeleton height={28} width="42%" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "var(--space-5)",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: "grid", gap: "var(--space-2)" }}>
            <Skeleton height={220} radius="var(--radius-lg)" />
            <Skeleton height={14} width="70%" />
            <Skeleton height={14} width="40%" />
          </div>
        ))}
      </div>
    </div>
  );
}
