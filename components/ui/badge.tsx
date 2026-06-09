import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Status pill / badge (DESIGN §3.5). Tones map to FUNCTIONAL colors literally —
 * never the lime accent (lime is the action color only). `dot` shows the leading
 * status dot. Use the helper maps below to derive a tone from a domain status.
 */
export type PillTone = "success" | "warning" | "critical" | "info" | "muted";

export interface PillProps {
  tone?: PillTone;
  dot?: boolean;
  children: ReactNode;
}

export function Pill({ tone = "muted", dot = true, children }: PillProps) {
  return (
    <span className={cx("pill", `pill-${tone}`)}>
      {dot && <span className="dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ---- Domain → tone maps (DESIGN §3.5, literal mappings) ---- */

export const PAYMENT_TONE: Record<string, PillTone> = {
  pending: "warning",
  paid: "success",
  refunded: "muted",
};

export const FULFILLMENT_TONE: Record<string, PillTone> = {
  unfulfilled: "muted",
  fulfilled: "success",
  cancelled: "critical",
};

/** Product/store status: active/live → success, draft → muted (neutral), suspended → critical. */
export const STATUS_TONE: Record<string, PillTone> = {
  active: "success",
  live: "success",
  draft: "muted",
  suspended: "critical",
};

export const INVENTORY_TONE: Record<string, PillTone> = {
  "in-stock": "success",
  low: "warning",
  out: "critical",
};
