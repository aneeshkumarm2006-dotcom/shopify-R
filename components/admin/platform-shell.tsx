"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider, Icon, type IconName } from "@/components/ui";
import { doSignOut } from "@/lib/auth/actions";

/**
 * Super-admin (platform operator) shell — a portal distinct from the merchant
 * dashboard. It has its OWN sidebar of cross-tenant operator sections and shows none
 * of the merchant store-management UI (no store switcher, no products/builder/etc.).
 * Provides the `ToastProvider` the operator action buttons rely on.
 */
const NAV: { label: string; href: string; icon: IconName }[] = [
  { label: "Overview", href: "/platform/overview", icon: "home" },
  { label: "Incidents", href: "/platform/incidents", icon: "alert" },
  { label: "Stores", href: "/platform", icon: "store" },
  { label: "Orders", href: "/platform/orders", icon: "orders" },
  { label: "Traffic", href: "/platform/traffic", icon: "analytics" },
  { label: "Activity", href: "/platform/activity", icon: "clock" },
  { label: "Audit", href: "/platform/audit", icon: "lock" },
  { label: "Users", href: "/platform/users", icon: "customers" },
  { label: "Health", href: "/platform/health", icon: "info" },
  { label: "Moderation", href: "/platform/moderation", icon: "eye" },
  { label: "Billing", href: "/platform/billing", icon: "tag" },
  { label: "System", href: "/platform/system", icon: "settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/platform") {
    return pathname === "/platform" || pathname.startsWith("/platform/stores");
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export function PlatformShell({
  children,
  openIncidents = 0,
}: {
  children: ReactNode;
  openIncidents?: number;
}) {
  const pathname = usePathname() ?? "";
  return (
    <ToastProvider>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <span className="admin-brand-mark" aria-hidden="true">
              <Icon name="store" size={13} style={{ color: "var(--accent)" }} />
            </span>
            <span className="admin-brand-word">Offshelf</span>
          </div>
          <div
            style={{
              padding: "0 12px 12px",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Platform admin
          </div>

          <nav className="admin-nav" aria-label="Platform">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`admin-nav-item${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="nav-icon">
                    <Icon name={n.icon} size={18} aria-hidden />
                  </span>
                  <span className="nav-label">{n.label}</span>
                  {n.href === "/platform/incidents" && openIncidents > 0 && (
                    <span className="admin-nav-badge mono">{openIncidents}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="admin-plan">
            <form action={doSignOut}>
              <button type="submit" className="btn btn-sm btn-ghost" style={{ width: "100%" }}>
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header className="admin-topbar">
            <form action="/platform/search" style={{ flex: 1, maxWidth: 460 }}>
              <label className="admin-search" style={{ width: "100%" }}>
                <Icon name="search" size={15} aria-hidden />
                <input
                  type="search"
                  name="q"
                  placeholder="Search stores, users, orders, products…"
                  aria-label="Global search"
                  style={{
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    color: "inherit",
                    font: "inherit",
                  }}
                />
              </label>
            </form>
          </header>
          <main className="admin-main">
            <div className="admin-content">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
