"use client";

import { useTransition } from "react";
import { Icon } from "@/components/ui";
import { stopImpersonation } from "@/app/(admin)/platform/actions";

/**
 * Persistent, non-dismissible banner shown whenever a platform operator is viewing a
 * store via impersonation (read-only v1). Names the target store, states READ-ONLY,
 * and offers an explicit Exit. Rendered by the admin layout when `ctx.impersonating`.
 */
export function ImpersonationBanner({ storeName }: { storeName: string }) {
  const [pending, start] = useTransition();
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "8px 16px",
        background: "var(--warning, #b45309)",
        color: "#fff",
        fontSize: "var(--text-sm)",
        fontWeight: 500,
      }}
    >
      <Icon name="eye" size={15} aria-hidden />
      <span>
        Viewing <strong>{storeName}</strong> as operator · <strong>READ-ONLY</strong> — changes are blocked.
      </span>
      <button
        type="button"
        onClick={() => start(() => void stopImpersonation())}
        disabled={pending}
        style={{
          marginLeft: "auto",
          background: "rgba(255,255,255,0.18)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.4)",
          borderRadius: "var(--radius-sm)",
          padding: "4px 12px",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {pending ? "Exiting…" : "Exit impersonation"}
      </button>
    </div>
  );
}
