import { cx } from "./cx";

/**
 * Switch / toggle (DESIGN §3). Controlled: pass `checked` + `onChange`.
 * Renders a real `role="switch"` with `aria-checked`; keyboard-operable as a button.
 */
export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  id?: string;
}

export function Switch({ checked, onChange, disabled, id, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={rest["aria-label"]}
      disabled={disabled}
      className={cx("switch", checked && "on")}
      onClick={() => onChange(!checked)}
    />
  );
}
