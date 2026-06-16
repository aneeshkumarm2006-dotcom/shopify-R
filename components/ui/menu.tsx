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
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /** The enabled menu items, in DOM order — the keyboard navigation set. */
  function items(): HTMLElement[] {
    return Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
  }

  /** Anchor the menu to the trigger in viewport coordinates. */
  function reposition() {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(
      align === "right"
        ? { top: rect.bottom + 4, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 4, left: rect.left },
    );
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
              right: pos.right,
              zIndex: 60,
              width,
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
