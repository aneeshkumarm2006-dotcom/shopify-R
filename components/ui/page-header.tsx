import type { ReactNode } from "react";

/**
 * Page-header pattern (DESIGN §3.10). Every admin page: optional breadcrumb →
 * H1 (+ optional status pill) on the left, primary action + overflow on the right,
 * a hairline divider underneath. Keep it identical across screens.
 */
export interface PageHeaderProps {
  title: ReactNode;
  /** Status pill shown beside the title. */
  pill?: ReactNode;
  /** Breadcrumb / back link row above the title. */
  breadcrumb?: ReactNode;
  /** Secondary meta line under the title. */
  meta?: ReactNode;
  /** Right-aligned actions (primary + overflow). */
  actions?: ReactNode;
}

export function PageHeader({
  title,
  pill,
  breadcrumb,
  meta,
  actions,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      {breadcrumb && <div className="breadcrumb">{breadcrumb}</div>}
      <div className="page-header-row">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <h1>{title}</h1>
            {pill}
          </div>
          {meta && (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              {meta}
            </div>
          )}
        </div>
        {actions && <div className="actions">{actions}</div>}
      </div>
      <hr className="divider" style={{ marginTop: "var(--space-4)" }} />
    </div>
  );
}
