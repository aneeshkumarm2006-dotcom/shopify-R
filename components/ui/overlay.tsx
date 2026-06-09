"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Shared overlay shell for Modal / Sheet / CartSheet (DESIGN §3.7). Renders a
 * scrim into <body> (so overlays escape any local stacking/theme island and use
 * the global theme), closes on Esc + scrim-click, locks body scroll, moves focus
 * into the panel on open, and restores it on close. The `children` element carries
 * the `role="dialog"` semantics and its own sizing (`.modal` / `.sheet`).
 */
export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  /** center → modal; right → slide-in sheet. */
  placement?: "center" | "right";
  /** Disable Esc + scrim-click (e.g. destructive action in progress). */
  dismissable?: boolean;
  children: ReactNode;
}

export function Overlay({
  open,
  onClose,
  placement = "center",
  dismissable = true,
  children,
}: OverlayProps) {
  const scrimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const FOCUSABLE =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const onKey = (e: KeyboardEvent) => {
      if (dismissable && e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap (DESIGN §6 — keyboard must not escape an open dialog). Cycle Tab
      // within the panel so SR/keyboard users stay inside the modal/sheet.
      if (e.key === "Tab") {
        const el = scrimRef.current;
        if (!el) return;
        const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (n) => n.offsetParent !== null || n === document.activeElement,
        );
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !el.contains(active))) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      const el = scrimRef.current;
      if (!el) return;
      const focusable = el.querySelector<HTMLElement>(FOCUSABLE);
      focusable?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, dismissable, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={scrimRef}
      className={placement === "right" ? "scrim scrim-right" : "scrim scrim-center"}
      onMouseDown={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
