"use client";

import { useState } from "react";
import type { Section } from "@/types";
import { Icon } from "@/components/ui";
import { SECTION_META } from "./section-catalog";

/**
 * Builder structure tree (left column · DESIGN §4.9). Three groups — HEADER, the
 * active template's sections, FOOTER. Header/footer are fixed shared regions (no
 * drag, no hide). Template sections drag-to-reorder (also ↑/↓ from the handle for
 * keyboard), toggle visibility, and highlight the active selection. "Add section"
 * opens the closed-set picker.
 */
export interface BuilderTreeProps {
  templateLabel: string;
  header: Section;
  footer: Section;
  sections: Section[];
  selectedId: string | null;
  hidden: Record<string, boolean>;
  onSelect: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onAdd: () => void;
}

export function BuilderTree({
  templateLabel,
  header,
  footer,
  sections,
  selectedId,
  hidden,
  onSelect,
  onToggleHidden,
  onReorder,
  onAdd,
}: BuilderTreeProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <nav className="bld-tree" aria-label="Page structure">
      <TreeGroup label="Header" defaultOpen={false}>
        <TreeNode
          icon={SECTION_META.header.icon}
          label={SECTION_META.header.label}
          active={selectedId === header.id}
          onClick={() => onSelect(header.id)}
        />
      </TreeGroup>

      <TreeGroup label={`Template · ${templateLabel}`}>
        {sections.map((section, index) => {
          const meta = SECTION_META[section.type];
          return (
            <TreeNode
              key={section.id}
              icon={meta.icon}
              label={meta.label}
              active={selectedId === section.id}
              hidden={hidden[section.id]}
              draggable
              dragging={dragIndex === index}
              onClick={() => onSelect(section.id)}
              onToggleHide={() => onToggleHidden(section.id)}
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDropAt={() => {
                if (dragIndex != null && dragIndex !== index) onReorder(dragIndex, index);
                setDragIndex(null);
              }}
              onMove={(dir) => onReorder(index, index + dir)}
            />
          );
        })}
        {sections.length === 0 && <p className="bld-tree-empty">No sections yet.</p>}
        <button type="button" className="bld-add-section" onClick={onAdd}>
          <Icon name="plus" size={15} aria-hidden />
          Add section
        </button>
      </TreeGroup>

      <TreeGroup label="Footer" defaultOpen={false}>
        <TreeNode
          icon={SECTION_META.footer.icon}
          label={SECTION_META.footer.label}
          active={selectedId === footer.id}
          onClick={() => onSelect(footer.id)}
        />
      </TreeGroup>
    </nav>
  );
}

/* ----------------------------------------------------------------- group ---- */
function TreeGroup({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bld-tree-group">
      <button
        type="button"
        className="bld-tree-grouphead"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Icon name={open ? "chevronDown" : "chevronRight"} size={14} aria-hidden />
        <span className="eyebrow">{label}</span>
      </button>
      {open && <div className="bld-tree-nodes">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ node ---- */
interface TreeNodeProps {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  active?: boolean;
  hidden?: boolean;
  draggable?: boolean;
  dragging?: boolean;
  onClick: () => void;
  onToggleHide?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDropAt?: () => void;
  onMove?: (dir: -1 | 1) => void;
}

function TreeNode({
  icon,
  label,
  active,
  hidden,
  draggable,
  dragging,
  onClick,
  onToggleHide,
  onDragStart,
  onDragEnd,
  onDropAt,
  onMove,
}: TreeNodeProps) {
  return (
    <div
      className="bld-treenode"
      data-active={active || undefined}
      data-hidden={hidden || undefined}
      data-dragging={dragging || undefined}
      draggable={draggable}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => draggable && e.preventDefault()}
      onDrop={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDropAt?.();
      }}
      role="button"
      tabIndex={0}
      // Advertise the keyboard reorder alternative to drag-and-drop (DESIGN §6) so it's
      // discoverable to screen-reader users, not just mouse users.
      aria-keyshortcuts={draggable && onMove ? "Alt+ArrowUp Alt+ArrowDown" : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        } else if (onMove && (e.altKey || e.metaKey) && e.key === "ArrowUp") {
          e.preventDefault();
          onMove(-1);
        } else if (onMove && (e.altKey || e.metaKey) && e.key === "ArrowDown") {
          e.preventDefault();
          onMove(1);
        }
      }}
    >
      {draggable ? (
        <span
          className="bld-treenode-drag"
          aria-hidden
          title="Drag to reorder, or focus and press Alt + ↑/↓"
        >
          <Icon name="drag" size={14} />
        </span>
      ) : (
        <span className="bld-treenode-drag" aria-hidden />
      )}
      <Icon name={icon} size={15} aria-hidden className="bld-treenode-icon" />
      <span className="bld-treenode-label">{label}</span>
      {onToggleHide && (
        <button
          type="button"
          className="bld-treenode-eye"
          aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
          aria-pressed={hidden}
          onClick={(e) => {
            e.stopPropagation();
            onToggleHide();
          }}
        >
          <Icon name={hidden ? "eyeOff" : "eye"} size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}
