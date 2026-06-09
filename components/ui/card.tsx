import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";

/**
 * Card / panel (DESIGN §3.3) — the dominant admin container: `--surface`, hairline
 * border, `--radius-lg`. Optional header row (title + right-aligned action).
 * `pad={false}` removes the body padding (e.g. when wrapping a flush data table).
 */
export interface CardProps {
  title?: ReactNode;
  action?: ReactNode;
  pad?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Card({
  title,
  action,
  pad = true,
  className,
  style,
  children,
}: CardProps) {
  return (
    <div className={cx("card", className)} style={style}>
      {title && (
        <div className="card-header">
          <div className="card-title">{title}</div>
          {action}
        </div>
      )}
      {pad ? (
        <div className="card-pad" style={title ? { paddingTop: "var(--space-5)" } : undefined}>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
