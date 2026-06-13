"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import { resolveIncident } from "@/app/(admin)/platform/actions";

/**
 * Operator resolve / reopen control for a single incident. Lives client-side (the
 * Incidents screen is a server component) so it can drive `useTransition` + a toast
 * and `router.refresh()` the server-rendered list once the action settles.
 */
export function ResolveIncidentButton({
  id,
  resolved,
}: {
  /** The incident id. */
  id: string;
  /** The target state: `true` = mark resolved, `false` = reopen. */
  resolved: boolean;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  return (
    <Button
      variant={resolved ? "default" : "ghost"}
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await resolveIncident(id, resolved);
          if (res.ok) {
            toast(resolved ? "Incident marked resolved." : "Incident reopened.", {
              tone: "success",
            });
            router.refresh();
          } else {
            toast("Couldn't update incident.", { tone: "critical" });
          }
        })
      }
    >
      {resolved ? "Mark resolved" : "Reopen"}
    </Button>
  );
}
