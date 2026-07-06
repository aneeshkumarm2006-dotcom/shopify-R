"use client";

import { useEffect } from "react";

/**
 * Guard against losing unsaved edits (Shopify's contextual-save-bar behavior). While
 * `enabled` is true:
 *   - a browser refresh / tab close / external navigation triggers the native
 *     "Leave site? Changes you made may not be saved." prompt (`beforeunload`), and
 *   - an in-app click on an internal link is intercepted and confirmed first, so a
 *     mis-clicked breadcrumb / nav item can't silently discard an edit.
 *
 * Uses the native `window.confirm` for the in-app case deliberately: it's synchronous,
 * so it can block the click before the App Router navigation begins (an async modal
 * can't). Programmatic `router.push` from buttons isn't covered — guard those at the
 * call site with the same message.
 */
const LEAVE_MESSAGE = "You have unsaved changes. Leave without saving?";

export function useUnsavedChanges(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const onClick = (e: MouseEvent) => {
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
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(LEAVE_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture phase so we intercept before Next's Link handler runs.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [enabled]);
}
