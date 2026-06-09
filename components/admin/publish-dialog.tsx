"use client";

import type { ReactNode } from "react";
import type { Store } from "@/types";
import { Button, Icon, Modal } from "@/components/ui";
import { storeDomain } from "@/lib/format";

/**
 * Publish flow confirm (DESIGN §4.11). A small checklist modal: subdomain set
 * (required), ≥1 active product (recommended — warn, don't block), age gate
 * configured. On confirm the parent flips `status: live` + stamps `publishedAt`
 * (stubbed in Part A). Reused by the dashboard nudge and the Publish screen.
 */
export interface PublishDialogProps {
  open: boolean;
  onClose: () => void;
  store: Store;
  activeProductCount: number;
  /** Disables Cancel + shows the confirm button as loading while the action runs. */
  pending?: boolean;
  onConfirm: () => void;
}

function CheckRow({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "var(--radius-sm)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          background: ok ? "var(--success-bg)" : "var(--warning-bg)",
          color: ok ? "var(--success)" : "var(--warning)",
        }}
      >
        <Icon name={ok ? "check" : "alert"} size={14} aria-hidden />
      </span>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--text)" }}>{children}</span>
    </div>
  );
}

export function PublishDialog({
  open,
  onClose,
  store,
  activeProductCount,
  pending = false,
  onConfirm,
}: PublishDialogProps) {
  const hasSubdomain = Boolean(store.subdomain);
  const hasActiveProduct = activeProductCount >= 1;
  const ageGateOn = store.ageGate.enabled;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Publish your store"
      maxWidth={460}
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="sparkle"
            disabled={!hasSubdomain}
            loading={pending}
            onClick={onConfirm}
          >
            Publish store
          </Button>
        </>
      }
    >
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--text-muted)",
          marginBottom: "var(--space-4)",
        }}
      >
        Your store will be reachable at{" "}
        <span className="mono" style={{ color: "var(--text-strong)" }}>
          {storeDomain(store.subdomain)}
        </span>
        .
      </p>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-2)" }}>
        <CheckRow ok={hasSubdomain}>Subdomain claimed (required)</CheckRow>
        <CheckRow ok={hasActiveProduct}>
          {hasActiveProduct
            ? "At least one active product"
            : "No active products yet (recommended)"}
        </CheckRow>
        <CheckRow ok={ageGateOn}>Age gate configured (21+)</CheckRow>
      </div>
      {!hasActiveProduct && (
        <p
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
            marginTop: "var(--space-3)",
          }}
        >
          You can publish without active products, but customers will see an empty
          storefront.
        </p>
      )}
    </Modal>
  );
}
