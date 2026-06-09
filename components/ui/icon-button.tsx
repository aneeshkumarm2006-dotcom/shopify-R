import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cx } from "./cx";

/**
 * Icon-only button (DESIGN §3.1). Sizes 28/32/36 match the admin density scale.
 * `aria-label` is required (enforced via prop type) since there's no visible text;
 * pass `tip` to also show a hover tooltip.
 */
export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  name: IconName;
  size?: 28 | 32 | 36;
  iconSize?: number;
  /** Required — names the action for screen readers. */
  "aria-label": string;
  /** Optional hover tooltip text. */
  tip?: string;
}

export function IconButton({
  name,
  size = 32,
  iconSize,
  tip,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const button = (
    <button
      type={type}
      className={cx("iconbtn", `sz-${size}`, className)}
      {...rest}
    >
      <Icon name={name} size={iconSize ?? (size >= 36 ? 18 : 16)} aria-hidden />
    </button>
  );

  if (tip) {
    return (
      <span className="tip" data-tip={tip}>
        {button}
      </span>
    );
  }
  return button;
}
