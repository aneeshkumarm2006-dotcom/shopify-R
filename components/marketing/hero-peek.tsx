"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * Interactive hero peek (marketing). A faux admin window whose sidebar items are
 * real tabs: selecting one moves the lime highlight and swaps the preview panel
 * to a mock view for that section. Purely client-side — it demos the product
 * surface without leaving the landing page or touching real data.
 */

type SectionId = "home" | "orders" | "products" | "inventory" | "customers" | "store";

const NAV: { id: SectionId; icon: IconName; label: string }[] = [
  { id: "home", icon: "home", label: "Home" },
  { id: "orders", icon: "orders", label: "Orders" },
  { id: "products", icon: "products", label: "Products" },
  { id: "inventory", icon: "inventory", label: "Inventory" },
  { id: "customers", icon: "customers", label: "Customers" },
  { id: "store", icon: "store", label: "Online Store" },
];

/* ---------- shared skeleton atoms ---------- */

function Bar({ className = "" }: { className?: string }) {
  return <div className={`h-2.5 rounded-full bg-surface-sunken ${className}`} />;
}

/* ---------- per-section mock previews ---------- */

function PreviewHome() {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="h-3 w-24 rounded-full bg-accent" />
      <div className="mt-4 grid grid-cols-3 gap-3">
        {["Total sales", "Orders", "Customers"].map((label) => (
          <div key={label} className="rounded-md border border-border p-3">
            <Bar className="w-12" />
            <div className="mono mt-2 h-5 w-16 rounded bg-accent-tint" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-24 items-end gap-2 rounded-md border border-border p-3">
        {[40, 65, 50, 80, 55, 72, 60].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-accent-tint"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function PreviewRows({
  accentCol,
  rows = 5,
}: {
  accentCol?: "lead" | "trail";
  rows?: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <Bar className="w-28 bg-accent/70" />
        <div className="h-6 w-16 rounded-md bg-accent-tint" />
      </div>
      <div className="mt-1 divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            {accentCol === "lead" && (
              <div className="h-7 w-7 shrink-0 rounded-full bg-accent-tint" />
            )}
            <Bar className="w-28" />
            <div className="flex-1" />
            <Bar className="hidden w-20 sm:block" />
            {accentCol === "trail" && (
              <div className="mono h-5 w-12 rounded bg-accent-tint" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewProducts() {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="h-3 w-24 rounded-full bg-accent" />
      <div className="mt-3 h-7 w-3/4 rounded-md bg-surface-sunken" />
      <div className="mt-2 h-7 w-1/2 rounded-md bg-surface-sunken" />
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-md border border-border p-2">
            <div className="aspect-square rounded bg-surface-sunken" />
            <div className="mt-2 h-2.5 w-full rounded-full bg-surface-sunken" />
            <div className="mono mt-1.5 h-2.5 w-10 rounded-full bg-accent-tint" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewInventory() {
  const levels = [82, 30, 64, 12, 48];
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <Bar className="w-28 bg-accent/70" />
        <Bar className="w-14" />
      </div>
      <div className="mt-1 divide-y divide-border">
        {levels.map((lvl, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="h-7 w-7 shrink-0 rounded bg-surface-sunken" />
            <Bar className="w-24" />
            <div className="flex-1" />
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className={lvl <= 20 ? "h-full bg-accent/40" : "h-full bg-accent"}
                style={{ width: `${lvl}%` }}
              />
            </div>
            <div className="mono h-5 w-8 rounded bg-accent-tint" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewStore() {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="mx-auto h-3 w-32 rounded-full bg-accent" />
      <div className="mx-auto mt-3 h-6 w-2/3 rounded-md bg-surface-sunken" />
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="overflow-hidden rounded-md border border-border">
            <div className="aspect-[4/3] bg-surface-sunken" />
            <div className="p-2">
              <Bar className="w-full" />
              <div className="mono mt-1.5 h-2.5 w-12 rounded-full bg-accent-tint" />
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-5 h-8 w-28 rounded-md bg-accent" />
    </div>
  );
}

function Preview({ section }: { section: SectionId }) {
  switch (section) {
    case "home":
      return <PreviewHome />;
    case "orders":
      return <PreviewRows accentCol="trail" rows={5} />;
    case "products":
      return <PreviewProducts />;
    case "inventory":
      return <PreviewInventory />;
    case "customers":
      return <PreviewRows accentCol="lead" rows={5} />;
    case "store":
      return <PreviewStore />;
  }
}

export function HeroPeek() {
  const [active, setActive] = useState<SectionId>("store");

  return (
    <div className="mx-auto mt-16 max-w-[920px]">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
        <div className="flex items-center gap-2 border-b border-border bg-surface-subtle px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-border-strong" />
          <span className="h-3 w-3 rounded-full bg-border-strong" />
          <span className="h-3 w-3 rounded-full bg-border-strong" />
          <span className="mono ml-3 truncate text-xs text-text-muted">
            yourstore.offshelf.app
          </span>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-[180px_1fr]">
          {/* admin sidebar — real tabs */}
          <div
            className="hidden flex-col gap-1 bg-surface p-4 sm:flex"
            role="tablist"
            aria-label="Preview a section of the Offshelf admin"
          >
            {NAV.map((n) => {
              const selected = active === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="hero-peek-panel"
                  onClick={() => setActive(n.id)}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors duration-fast ${
                    selected
                      ? "bg-accent-tint text-text-strong"
                      : "text-text-muted hover:bg-surface-subtle hover:text-text"
                  }`}
                >
                  <Icon name={n.icon} size={16} aria-hidden /> {n.label}
                </button>
              );
            })}
          </div>
          {/* preview panel */}
          <div
            id="hero-peek-panel"
            role="tabpanel"
            aria-live="polite"
            className="bg-bg-store p-6"
          >
            <Preview section={active} />
          </div>
        </div>
      </div>
    </div>
  );
}
