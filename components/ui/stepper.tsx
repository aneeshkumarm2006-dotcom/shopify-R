import { Icon } from "@/components/ui/icon";

/**
 * Numeric stepper (−/value/+) (DESIGN §3) — used for cart quantity and inventory
 * quick-edit. Controlled; clamps to [min, max]. The value field is mono/tabular.
 */
export interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  "aria-label"?: string;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  ...rest
}: StepperProps) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="stepper" role="group" aria-label={rest["aria-label"] ?? "Quantity"}>
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={value <= min}
        aria-label="Decrease"
      >
        <Icon name="minus" size={14} aria-hidden />
      </button>
      <input
        value={value}
        inputMode="numeric"
        aria-label={rest["aria-label"] ?? "Quantity"}
        onChange={(e) => set(parseInt(e.target.value || "0", 10) || 0)}
      />
      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={value >= max}
        aria-label="Increase"
      >
        <Icon name="plus" size={14} aria-hidden />
      </button>
    </div>
  );
}
