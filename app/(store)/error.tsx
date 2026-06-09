"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui";

/**
 * Storefront error boundary (Stage 14 — DESIGN §3.9). Plain-language, on-brand
 * failure state for a customer-facing page, with a retry. No stack traces ever reach
 * a shopper.
 */
export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="store-container" style={{ paddingTop: "var(--space-16)", paddingBottom: "var(--space-16)" }}>
      <ErrorState
        title="This page didn't load"
        body="Something went wrong. Please try again in a moment."
        onRetry={reset}
      />
    </div>
  );
}
