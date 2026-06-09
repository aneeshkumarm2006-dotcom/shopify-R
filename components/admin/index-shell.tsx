"use client";

import type { ReactNode } from "react";
import { Button, Icon, IconButton, ViewTabs, type TabItem } from "@/components/ui";

/**
 * Index-list shell (DESIGN §3.4 / §4) — the bordered card that wraps every admin
 * index table: a toolbar (view-tab filters with counts · search · sort · columns)
 * over a horizontally-scrollable table area, with an optional footer slot for the
 * bulk-action / pagination bar. Screens supply the `<table className="tbl">` body.
 */
export interface IndexShellProps {
  tabs: TabItem[];
  active: string;
  onTabChange: (value: string) => void;
  tabsLabel?: string;
  /** Omit to hide the search box. */
  query?: string;
  onQueryChange?: (value: string) => void;
  searchPlaceholder?: string;
  showSort?: boolean;
  /** Footer row (e.g. the bulk-action bar). */
  footer?: ReactNode;
  children: ReactNode;
}

export function IndexShell({
  tabs,
  active,
  onTabChange,
  tabsLabel,
  query,
  onQueryChange,
  searchPlaceholder = "Search…",
  showSort = true,
  footer,
  children,
}: IndexShellProps) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="index-toolbar">
        <ViewTabs
          tabs={tabs}
          active={active}
          onChange={onTabChange}
          aria-label={tabsLabel}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          {onQueryChange && (
            <div className="index-search">
              <span className="icon">
                <Icon name="search" size={15} aria-hidden />
              </span>
              <input
                className="input"
                type="search"
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                value={query ?? ""}
                onChange={(e) => onQueryChange(e.target.value)}
              />
            </div>
          )}
          {showSort && (
            <Button size="sm" variant="default" icon="arrowUpDown">
              Sort
            </Button>
          )}
          <IconButton name="sliders" size={32} tip="Columns" aria-label="Edit columns" />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
      {footer}
    </div>
  );
}
