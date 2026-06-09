import type { CSSProperties } from "react";
import { cx } from "./cx";

/**
 * Skeleton shimmer (DESIGN §3.9). Loading states use skeletons that match the
 * final layout — never a full-page spinner. Compose these to mirror real content.
 */
export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: string;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({
  width = "100%",
  height = 14,
  radius,
  className,
  style,
}: SkeletonProps) {
  return (
    <span
      className={cx("skeleton", className)}
      aria-hidden="true"
      style={{
        display: "block",
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

/** A skeleton stand-in for a data-table while rows load (DESIGN §3.4). */
export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading" style={{ width: "100%" }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            height: 52,
            padding: "0 var(--space-4)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              height={12}
              width={c === 0 ? "32%" : `${14 + ((r + c) % 3) * 6}%`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
