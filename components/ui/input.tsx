import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";

/**
 * Text input (DESIGN §3.2). 36px admin height; add `large` for the 48px storefront
 * size, `mono` for SKU/code fields, `error` for the critical border state.
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
  large?: boolean;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, mono, large, error, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cx(
        "input",
        mono && "mono",
        large && "input-lg",
        error && "is-error",
        className,
      )}
      {...rest}
    />
  );
});

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean;
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, mono, error, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cx("textarea", mono && "mono", error && "is-error", className)}
        {...rest}
      />
    );
  },
);

export type SelectOption = string | { value: string; label: string };

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[];
  error?: boolean;
  large?: boolean;
}

/** Native select with the custom chevron baked into `.select` (DESIGN §3.2). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, error, large, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cx("select", large && "input-lg", error && "is-error", className)}
      {...rest}
    >
      {options
        ? options.map((o) =>
            typeof o === "string" ? (
              <option key={o} value={o}>
                {o}
              </option>
            ) : (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ),
          )
        : children}
    </select>
  );
});

/** Price input — mono, currency prefix from `store.settings` (DESIGN §3.2). */
export interface PriceInputProps extends InputProps {
  currency?: string;
}

export const PriceInput = forwardRef<HTMLInputElement, PriceInputProps>(
  function PriceInput({ currency = "$", className, error, ...rest }, ref) {
    return (
      <div className="input-group">
        <span className="input-prefix">{currency}</span>
        <Input
          ref={ref}
          mono
          error={error}
          inputMode="decimal"
          className={className}
          {...rest}
        />
      </div>
    );
  },
);

/** DNS/URL-safe slug from arbitrary text (mirrors the storefront handle rule). */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Handle / slug input (DESIGN §3.2) — mono field with a live URL preview:
 * `northbound.offshelf.app/products/<handle>`. `base` is the path prefix shown
 * before the handle. The value is the raw handle (already a slug).
 */
export interface HandleInputProps extends Omit<InputProps, "mono"> {
  /** Text shown before the handle in the preview, e.g. `store.offshelf.app/products/`. */
  base: string;
  value: string;
}

export const HandleInput = forwardRef<HTMLInputElement, HandleInputProps>(
  function HandleInput({ base, value, error, ...rest }, ref) {
    return (
      <>
        <Input ref={ref} mono value={value} error={error} spellCheck={false} {...rest} />
        <span className="handle-preview">
          {base}
          <b>{value || "handle"}</b>
        </span>
      </>
    );
  },
);
