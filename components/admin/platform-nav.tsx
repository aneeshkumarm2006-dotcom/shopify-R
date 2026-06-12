import Link from "next/link";
import { cx } from "@/components/ui";

/**
 * Platform operator sub-nav (Stage 14) — the cross-tenant operator views:
 * Overview (KPIs), Stores list, the Activity feed, Health (alignment), Users,
 * and Billing (reporting). Rendered as real `<a>`s (server navigation, no client
 * state) using the shared underline `.tab` styling so it reads identically to
 * admin content tabs.
 */
export type PlatformTab =
  | "overview"
  | "stores"
  | "activity"
  | "health"
  | "users"
  | "billing";

const TABS: { id: PlatformTab; label: string; href: string }[] = [
  { id: "overview", label: "Overview", href: "/platform/overview" },
  { id: "stores", label: "Stores", href: "/platform" },
  { id: "activity", label: "Activity", href: "/platform/activity" },
  { id: "health", label: "Health", href: "/platform/health" },
  { id: "users", label: "Users", href: "/platform/users" },
  { id: "billing", label: "Billing", href: "/platform/billing" },
];

export function PlatformNav({ active }: { active: PlatformTab }) {
  return (
    <nav
      className="tabs"
      aria-label="Platform sections"
      style={{ marginBottom: "var(--space-5)" }}
    >
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={cx("tab", active === t.id && "active")}
          aria-current={active === t.id ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
