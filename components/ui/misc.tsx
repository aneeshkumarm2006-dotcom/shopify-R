import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";

/** All-caps micro-label (DESIGN §2.3, +0.08em tracking). */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cx("eyebrow", className)}>{children}</span>;
}

/** Hairline divider (DESIGN §2.4) — the primary structural device in admin. */
export function Divider({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <hr className={cx("divider", className)} style={style} />;
}
