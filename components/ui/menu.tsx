"use client";

import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
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
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /** The enabled menu items, in DOM order — the keyboard navigation set. */
  function items(): HTMLElement[] {
    return Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
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
    // Move focus into the menu so arrow keys work immediately (DESIGN §6).
    requestAnimationFrame(() => items()[0]?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: "inline-flex" }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </div>
      {open && (
        <div
          ref={menuRef}
          className="menu"
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            [align]: 0,
            zIndex: 60,
            width,
          }}
        >
          {typeof children === "function"
            ? children(() => setOpen(false))
            : children}
        </div>
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
