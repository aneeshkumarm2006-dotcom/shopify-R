"use client";

import { useTransition } from "react";
import { Button, useToast } from "@/components/ui";
import { startImpersonation } from "@/app/(admin)/platform/actions";

/**
 * Operator "Act as merchant" control on the store-detail page. Starts a read-only
 * impersonation session (server-side gated to platform_admin + audited) and the action
 * redirects into the merchant dashboard for that store.
 */
export function ImpersonationStartButton({ storeId }: { storeId: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      variant="default"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await startImpersonation(storeId);
          // On success the action redirects; only an error returns here.
          if (res && !res.ok) toast(res.error ?? "Couldn't start impersonation.", { tone: "critical" });
        })
      }
    >
      Act as merchant (read-only)
    </Button>
  );
}
