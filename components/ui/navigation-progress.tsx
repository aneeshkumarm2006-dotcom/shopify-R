"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Top navigation progress bar (Shopify-style). App Router `<Link>` clicks block on the
 * server RSC fetch with no built-in indicator, so navigation can feel stalled. This
 * arms a slim lime bar the instant an internal link is clicked and completes it when
 * the pathname actually changes.
 *
 * Deliberately keyed off `usePathname()` only (NOT `useSearchParams`, which would opt
 * every page into dynamic rendering). A safety timeout retracts the bar if a click
 * doesn't lead to a real navigation (same-page / cancelled), so it can never hang.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<{ active: boolean; width: number }>({ active: false, width: 0 });
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (trickle.current) clearInterval(trickle.current);
    if (safety.current) clearTimeout(safety.current);
    trickle.current = null;
    safety.current = null;
  };

  // Complete the bar when the route actually changes.
  useEffect(() => {
    clearTimers();
    setState((s) => (s.active ? { active: true, width: 100 } : s));
    const done = setTimeout(() => setState({ active: false, width: 0 }), 240);
    return () => clearTimeout(done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Arm the bar on an internal link click.
  useEffect(() => {
    function start() {
      clearTimers();
      setState({ active: true, width: 8 });
      trickle.current = setInterval(() => {
        setState((s) => ({ active: true, width: Math.min(s.width + Math.random() * 12, 90) }));
      }, 250);
      // If nothing navigates within 10s, retract so the bar never sticks.
      safety.current = setTimeout(() => {
        clearTimers();
        setState({ active: false, width: 0 });
      }, 10000);
    }
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // same page / hash / query-only
      start();
    }
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, []);

  if (!state.active && state.width === 0) return null;
  return (
    <div
      aria-hidden
      style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, zIndex: 9999, pointerEvents: "none" }}
    >
      <div
        style={{
          height: "100%",
          width: `${state.width}%`,
          background: "var(--accent)",
          boxShadow: "0 0 8px var(--accent)",
          borderRadius: "0 2px 2px 0",
          transition: "width 240ms ease, opacity 200ms ease",
          opacity: state.width >= 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
