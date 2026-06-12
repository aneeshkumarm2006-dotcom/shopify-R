"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StoreStatus } from "@/types";
import { Button, Modal, useToast } from "@/components/ui";
import { setStoreStatusAction } from "@/app/(admin)/platform/actions";

/**
 * Lifecycle controls for the operator store-detail view (Stage 14). The only
 * mutation in the operator portal — Suspend (storefront offline immediately) /
 * Reinstate. Wraps the existing cross-tenant `setStoreStatusAction` (which re-asserts
 * `requirePlatformAdmin` server-side and keys by subdomain) in a `useTransition`, with
 * a confirm for the destructive suspend. On success it refreshes so the config
 * snapshot + health re-derive from the new status.
 */
export function StoreLifecycleControls({
  subdomain,
  storeName,
  status,
}: {
  subdomain: string;
  storeName: string;
  status: StoreStatus;
}) {
  const toast = useToast();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(next: StoreStatus, successMsg: string) {
    startTransition(async () => {
      const res = await setStoreStatusAction(subdomain, next);
      if (res.ok) {
        toast(successMsg, next === "suspended" ? { tone: "critical" } : undefined);
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast(res.error ?? "Couldn't update the store", { tone: "critical" });
      }
    });
  }

  if (status === "suspended") {
    return (
      <Button
        variant="default"
        icon="refresh"
        disabled={pending}
        onClick={() => run("live", `${storeName} reinstated`)}
      >
        Reinstate store
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="critical"
        icon="lock"
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
      >
        Suspend store
      </Button>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Suspend ${storeName}`}
        maxWidth={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="critical-solid"
              disabled={pending}
              onClick={() => run("suspended", `${storeName} suspended`)}
            >
              Suspend store
            </Button>
          </>
        }
      >
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text)",
            margin: 0,
          }}
        >
          Suspending takes the storefront offline immediately. The merchant keeps
          dashboard access.
        </p>
      </Modal>
    </>
  );
}
