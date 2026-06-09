"use client";

import { type ReactNode } from "react";
import { Icon, IconButton } from "@/components/ui";

/**
 * Small form controls shared by the builder's per-section settings forms (Stage 4).
 * Kept here so every settings form labels and lays out repeated/segmented inputs the
 * same way.
 */

/* ---------------------------------------------------- segmented toggle ---- */
export interface ToggleRowProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

/** A compact segmented control — for enum settings (height, align, columns, side). */
export function ToggleRow({ label, options, value, onChange }: ToggleRowProps) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="bld-segmented" role="group" aria-label={label}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              className="bld-segment"
              data-active={active || undefined}
              aria-pressed={active}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ repeatable list ---- */
export interface RepeatableListProps<T> {
  label: string;
  items: T[];
  onChange: (next: T[]) => void;
  /** Render the editable fields for one item. `update` patches that item. */
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  /** Factory for a new item when "Add" is pressed. */
  newItem: () => T;
  addLabel: string;
  /** Hard cap on item count (e.g. footer columns). */
  max?: number;
  /** Compact one-line rows (no card chrome) — e.g. gallery image slots. */
  emptyHint?: string;
}

/**
 * A reorderable add/remove list — the builder's "blocks within a section" affordance
 * (PRD §6.2). Each row carries a drag handle (also keyboard ↑/↓ to move) and a remove
 * button; the section's settings array IS the block list, so edits write straight back
 * into a valid `themeConfig`.
 */
export function RepeatableList<T>({
  label,
  items,
  onChange,
  renderItem,
  newItem,
  addLabel,
  max,
  emptyHint,
}: RepeatableListProps<T>) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = items.slice();
    const [m] = next.splice(from, 1);
    if (m === undefined) return;
    next.splice(to, 0, m);
    onChange(next);
  };
  const update = (index: number, patch: Partial<T>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const add = () => {
    if (max != null && items.length >= max) return;
    onChange([...items, newItem()]);
  };
  const atMax = max != null && items.length >= max;

  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="bld-list">
        {items.length === 0 && emptyHint && <p className="bld-list-empty">{emptyHint}</p>}
        {items.map((item, i) => (
          <div
            key={i}
            className="bld-list-row"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (!Number.isNaN(from)) move(from, i);
            }}
          >
            <button
              type="button"
              className="bld-drag"
              aria-label={`Reorder item ${i + 1}. Use arrow up and down to move.`}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  move(i, i - 1);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(i, i + 1);
                }
              }}
            >
              <Icon name="drag" size={14} aria-hidden />
            </button>
            <div className="bld-list-fields">
              {renderItem(item, (patch) => update(i, patch), i)}
            </div>
            <IconButton
              name="trash"
              size={28}
              aria-label={`Remove item ${i + 1}`}
              onClick={() => remove(i)}
            />
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-default bld-add-item"
          onClick={add}
          disabled={atMax}
        >
          <Icon name="plus" size={13} aria-hidden />
          {addLabel}
        </button>
      </div>
    </div>
  );
}
