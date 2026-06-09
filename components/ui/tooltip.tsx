import type { ReactNode } from "react";

/**
 * Tooltip (DESIGN §3.6) — `--warm-900` bg / `--warm-50` text, appears above the
 * wrapped element on hover/focus (CSS-driven, see `.tip`). Keep tips short; they
 * are not a substitute for an accessible label on the control itself.
 */
export function Tooltip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <span className="tip" data-tip={tip}>
      {children}
    </span>
  );
}
