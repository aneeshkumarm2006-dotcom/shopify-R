"use client";

import { useId, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

/**
 * Field wrapper (DESIGN §3.2): label · control · help/error.
 *
 * Accessibility is wired automatically. Pass children as a render function to
 * receive the generated `id`, `aria-describedby`, and `aria-invalid` props:
 *
 *   <Field label="Email" help="We'll never share it.">
 *     {(p) => <Input type="email" {...p} />}
 *   </Field>
 *
 * Plain children also work (when you wire ids yourself or don't need them).
 */
export interface FieldA11yProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export interface FieldProps {
  label?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode | ((props: FieldA11yProps) => ReactNode);
}

export function Field({ label, help, error, required, children }: FieldProps) {
  const id = useId();
  const describedById = error ? `${id}-error` : help ? `${id}-help` : undefined;

  const a11y: FieldA11yProps = {
    id,
    "aria-describedby": describedById,
    "aria-invalid": error ? true : undefined,
  };

  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
          {required && (
            <span className="req" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {typeof children === "function" ? children(a11y) : children}
      {error ? (
        <span className="field-error" id={`${id}-error`} role="alert">
          <Icon name="alert" size={13} aria-hidden />
          {error}
        </span>
      ) : (
        help && (
          <span className="field-help" id={`${id}-help`}>
            {help}
          </span>
        )
      )}
    </div>
  );
}
