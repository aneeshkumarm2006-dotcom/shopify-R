import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cx } from "./cx";

/**
 * Button (DESIGN §3.1). Variants map to functional intent; the **primary** (lime)
 * variant is the single most-important action on a screen — one per view.
 * Loading swaps the label for a spinner, locks width, and disables the button.
 */
export type ButtonVariant =
  | "primary"
  | "default"
  | "ghost"
  | "critical"
  | "critical-solid";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  default: "btn-default",
  ghost: "btn-ghost",
  critical: "btn-critical",
  "critical-solid": "btn-critical-solid",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  block?: boolean;
  loading?: boolean;
  /** Icon before the label. */
  icon?: IconName;
  /** Icon after the label. */
  iconRight?: IconName;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export function Button({
  variant = "default",
  size = "md",
  pill,
  block,
  loading,
  icon,
  iconRight,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const iconSize = size === "sm" ? 14 : 16;
  return (
    <button
      type={type}
      className={cx(
        "btn",
        `btn-${size}`,
        VARIANT_CLASS[variant],
        pill && "btn-pill",
        block && "btn-block",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === "sm" ? 13 : 15} />
      ) : (
        icon && <Icon name={icon} size={iconSize} />
      )}
      {children != null && <span>{children}</span>}
      {iconRight && !loading && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}
