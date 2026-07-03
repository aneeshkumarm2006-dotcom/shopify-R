"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "@/components/ui/icon";
import { cx } from "./cx";

/**
 * Dropdown / popover / menu (DESIGN §3.6). Click-outside + Esc close, the trigger
 * gets `aria-expanded`, and the menu is keyboard-navigable. Children may be a
 * render function receiving `close` so items can dismiss the menu on select.
 */
export interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "left" | "right";
  width?: number;
}

export function Dropdown({
  trigger,
  children,
  align = "right",
  width,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  /**
   * Fixed (viewport) coordinates for the portaled menu. Rendering in a portal
   * lets the menu escape the `overflow: hidden`/`overflow: auto` of index-table
   * cards, which would otherwise clip a per-row menu (DESIGN §3.4/§3.6).
   */
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    maxHeight?: number;
    /** transform-origin for the open animation — the corner nearest the trigger. */
    origin: string;
  }>({
    top: 0,
    left: 0,
    origin: "top center",
  });
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /** The enabled menu items, in DOM order — the keyboard navigation set. */
  function items(): HTMLElement[] {
    return Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
  }

  /**
   * Anchor the menu to the trigger in viewport coordinates, then keep it on-screen:
   * clamp horizontally so a menu near the right/left edge never runs off, and flip
   * upward when there isn't room below. `maxHeight` (with the menu's own overflow-y)
   * caps tall menus to the available space instead of spilling past the viewport.
   */
  function reposition() {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8; // min breathing room from any viewport edge
    const gap = 4; // distance between trigger and menu
    const menuEl = menuRef.current;
    const menuW = menuEl?.offsetWidth || width || 180;
    const menuH = menuEl?.offsetHeight || 0;

    // Horizontal: align the menu's edge to the trigger, then clamp into view.
    let left = align === "right" ? rect.right - menuW : rect.left;
    left = Math.min(left, vw - menuW - margin);
    left = Math.max(margin, left);

    // Vertical: prefer below the trigger; flip above when below is too tight.
    const spaceBelow = vh - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    let top: number;
    let maxHeight: number;
    let placedBelow: boolean;
    if (menuH <= spaceBelow || spaceBelow >= spaceAbove) {
      top = rect.bottom + gap;
      maxHeight = vh - top - margin;
      placedBelow = true;
    } else {
      maxHeight = spaceAbove - margin;
      top = Math.max(margin, rect.top - gap - Math.min(menuH, maxHeight));
      placedBelow = false;
    }

    // Origin = the corner nearest the trigger, so the menu scales OUT of it:
    // vertical edge follows the flip (below → top edge, above → bottom edge),
    // horizontal edge follows alignment.
    const origin = `${placedBelow ? "top" : "bottom"} ${align === "right" ? "right" : "left"}`;
    setPos({ top, left, maxHeight: Math.max(0, maxHeight), origin });
  }

  // Position before paint so the menu never flashes at the wrong spot.
  useLayoutEffect(() => {
    if (open) reposition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        ref.current && !ref.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    // Keep the menu pinned to its trigger as the page scrolls/resizes.
    const onReflow = () => reposition();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        // Return focus to the trigger so the user isn't dropped at the top of the page.
        ref.current?.querySelector<HTMLElement>("button, [href]")?.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const list = items();
        if (list.length === 0) return;
        e.preventDefault();
        const idx = list.indexOf(document.activeElement as HTMLElement);
        const next =
          e.key === "ArrowDown"
            ? list[(idx + 1) % list.length]
            : list[(idx - 1 + list.length) % list.length];
        next?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    // Move focus into the menu so arrow keys work immediately (DESIGN §6).
    requestAnimationFrame(() => items()[0]?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: "inline-flex" }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </div>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="menu"
            role="menu"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              zIndex: 60,
              width,
              maxHeight: pos.maxHeight,
              overflowY: "auto",
              // Drives the origin-aware scale-in keyframe (see .menu in components.css).
              ["--menu-origin" as string]: pos.origin,
            }}
          >
            {typeof children === "function"
              ? children(() => setOpen(false))
              : children}
          </div>,
          document.body,
        )}
    </div>
  );
}

export interface MenuItemProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconName;
  danger?: boolean;
  /** Right-aligned hint (e.g. shortcut). */
  hint?: ReactNode;
}

export function MenuItem({
  icon,
  danger,
  hint,
  className,
  children,
  ...rest
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cx("menu-item", danger && "danger", className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={15} aria-hidden />}
      <span>{children}</span>
      {hint && <span className="menu-item-right">{hint}</span>}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="menu-sep" role="separator" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="menu-label">{children}</div>;
}
