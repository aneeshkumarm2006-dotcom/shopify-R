"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui";

/**
 * Admin route-group error boundary (Stage 14 — DESIGN §3.9: every screen has an
 * error state, plain-language + retry, never a stack trace). Catches render/data
 * errors in admin pages and offers `reset()` to retry. Renders inside the admin
 * chrome, so the sidebar/topbar stay put.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for server logs / observability; the user never sees the detail.
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="This page didn't load"
      body="Something went wrong on our end. Try again — if it keeps happening, refresh the page."
      onRetry={reset}
    />
  );
}
