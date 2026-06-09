import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button } from "./button";

/**
 * Empty / loading / error states (DESIGN §3.9) — required for every list & detail.
 * Empty is warm (not apologetic); error is plain-language + retry (never a stack
 * trace); loading uses skeletons (see <Skeleton/>), not full-page spinners.
 */
function StateShell({
  icon,
  tone = "muted",
  title,
  body,
  action,
}: {
  icon: IconName;
  tone?: "muted" | "critical";
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "var(--space-16) var(--space-6)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-3)",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "var(--radius-lg)",
          background: tone === "critical" ? "var(--critical-bg)" : "var(--surface-sunken)",
          display: "grid",
          placeItems: "center",
          color: tone === "critical" ? "var(--critical)" : "var(--text-muted)",
        }}
      >
        <Icon name={icon} size={24} aria-hidden />
      </div>
      <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-strong)" }}>
        {title}
      </div>
      {body && (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", maxWidth: 340 }}>
          {body}
        </div>
      )}
      {action && <div style={{ marginTop: "var(--space-2)" }}>{action}</div>}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: IconName;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon = "box", title, body, action }: EmptyStateProps) {
  return <StateShell icon={icon} title={title} body={body} action={action} />;
}

export interface ErrorStateProps {
  title?: ReactNode;
  body?: ReactNode;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  body = "We couldn't load this. Try again in a moment.",
  onRetry,
}: ErrorStateProps) {
  return (
    <StateShell
      icon="alertTri"
      tone="critical"
      title={title}
      body={body}
      action={
        onRetry && (
          <Button variant="default" icon="refresh" onClick={onRetry}>
            Retry
          </Button>
        )
      }
    />
  );
}

/**
 * Zero-filtered-results state (DESIGN §3.9) — distinct from "no data yet".
 * Offers a clear-filters affordance.
 */
export function NoResultsState({
  onClear,
  label = "No results match these filters",
}: {
  onClear?: () => void;
  label?: ReactNode;
}) {
  return (
    <StateShell
      icon="search"
      title={label}
      action={
        onClear && (
          <Button variant="ghost" onClick={onClear}>
            Clear filters
          </Button>
        )
      }
    />
  );
}
