"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Storefront pageview beacon (operator visitor analytics). Fires a best-effort POST
 * to `/api/track` on each storefront navigation. It manages its OWN random session id
 * in localStorage (no coupling to the cart/age-gate session) and sends no PII — just a
 * random session id + the path. Rendered once in the `(store)` layout for live stores.
 */
const SID_KEY = "offshelf_sid";

function sessionId(): string {
  try {
    let sid = localStorage.getItem(SID_KEY);
    if (!sid) {
      sid =
        (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return "anon";
  }
}

export function TrackPageview({ subdomain }: { subdomain: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!subdomain) return;
    const payload = JSON.stringify({
      subdomain,
      path: pathname || "/",
      sessionId: sessionId(),
      ref: document.referrer || null,
    });
    try {
      // `sendBeacon` survives navigation; fall back to keepalive fetch.
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      } else {
        void fetch("/api/track", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true });
      }
    } catch {
      /* analytics is best-effort */
    }
  }, [subdomain, pathname]);

  return null;
}
