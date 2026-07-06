"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

/**
 * App-wide confirmation dialog (Shopify never fires a destructive action without a
 * "Delete X? This can't be undone." interstitial). `useConfirm()` returns an async
 * `confirm(opts)` that resolves true/false, so any handler can gate a dangerous action:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete product?", confirmLabel: "Delete", destructive: true }))) return;
 *
 * One dialog instance is rendered at the provider; there is no per-call-site modal state
 * to wire. Provided at the root so it's available in admin and storefront alike.
 */
export interface ConfirmOptions {
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in the critical tone (default true for deletes). */
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    setOpts(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={opts !== null}
        onClose={() => settle(false)}
        title={opts?.title}
        maxWidth={440}
        footer={
          opts ? (
            <>
              <Button variant="default" onClick={() => settle(false)}>
                {opts.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={opts.destructive === false ? "primary" : "critical"}
                onClick={() => settle(true)}
                autoFocus
              >
                {opts.confirmLabel ?? "Confirm"}
              </Button>
            </>
          ) : null
        }
      >
        {opts?.message}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
