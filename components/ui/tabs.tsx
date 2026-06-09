import type { KeyboardEvent } from "react";
import { cx } from "./cx";

/**
 * Tabs (DESIGN §3.6) — underline style, content-only switching (filters, not
 * navigation). `ViewTabs` is the chip-filter variant used for saved views.
 * Both render real `role="tab"` semantics and are keyboard-operable: Tab reaches the
 * list, ←/→ (and Home/End) move between tabs with automatic activation (ARIA APG).
 */
export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (value: string) => void;
  "aria-label"?: string;
}

/**
 * Shared tablist arrow-key handler. Moves focus to the next/prev/first/last tab
 * button and activates it (automatic-activation pattern), keeping focus and the
 * selected tab in lockstep for keyboard + SR users.
 */
function onTablistKeyDown(e: KeyboardEvent<HTMLDivElement>, tabs: TabItem[], active: string) {
  const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
  if (!keys.includes(e.key)) return;
  e.preventDefault();
  const idx = tabs.findIndex((t) => t.value === active);
  let next = idx;
  if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
  else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = tabs.length - 1;
  const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  buttons[next]?.focus();
  return tabs[next]?.value;
}

export function Tabs({ tabs, active, onChange, ...rest }: TabsProps) {
  return (
    <div
      className="tabs"
      role="tablist"
      aria-label={rest["aria-label"]}
      onKeyDown={(e) => {
        const v = onTablistKeyDown(e, tabs, active);
        if (v) onChange(v);
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={active === t.value}
          className={cx("tab", active === t.value && "active")}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count != null && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function ViewTabs({ tabs, active, onChange, ...rest }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      style={{ display: "flex", gap: 2, flexWrap: "wrap" }}
      onKeyDown={(e) => {
        const v = onTablistKeyDown(e, tabs, active);
        if (v) onChange(v);
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={active === t.value}
          className={cx("viewtab", active === t.value && "active")}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count != null && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
