"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Must cover the longest panel exit animation (modal/sheet run at --dur-slow = 260ms). */
const EXIT_MS = 260;

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

  // Keep the overlay mounted through its EXIT animation: when `open` flips false we
  // switch to the "closed" phase (drives the exit keyframes) and only unmount after the
  // animation finishes — so modals/sheets/cart drawer slide+fade OUT instead of vanishing.
  const [rendered, setRendered] = useState(open);
  const [phase, setPhase] = useState<"open" | "closed">(open ? "open" : "closed");

  useEffect(() => {
    if (open) {
      setRendered(true);
      const id = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(id);
    }
    // Closing: play the exit animation, then unmount.
    setPhase("closed");
    const t = setTimeout(() => setRendered(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

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

  if (!rendered || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={scrimRef}
      data-state={phase}
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
