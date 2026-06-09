"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * Toasts (DESIGN §3.8) — bottom-left, auto-dismiss ~4s, max 3 stacked. Success =
 * check icon on a neutral surface (not a green flood). Errors that block work go
 * inline, not here. Wrap the app in <ToastProvider> and call `useToast()`.
 * The container is an `aria-live` region so announcements reach screen readers.
 */
type ToastTone = "success" | "info" | "critical";

interface ToastRecord {
  id: number;
  message: ReactNode;
  icon: IconName;
  tone: ToastTone;
}

interface ToastOptions {
  icon?: IconName;
  tone?: ToastTone;
  duration?: number;
}

type PushToast = (message: ReactNode, opts?: ToastOptions) => void;

const ToastContext = createContext<PushToast | null>(null);

const TONE_ICON: Record<ToastTone, IconName> = {
  success: "check",
  info: "info",
  critical: "alert",
};
const TONE_COLOR: Record<ToastTone, string> = {
  success: "var(--success)",
  info: "var(--info)",
  critical: "var(--critical)",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback<PushToast>((message, opts = {}) => {
    const id = nextId.current++;
    const tone = opts.tone ?? "success";
    setToasts((t) => [
      ...t,
      { id, message, tone, icon: opts.icon ?? TONE_ICON[tone] },
    ]);
    setTimeout(() => dismiss(id), opts.duration ?? 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-wrap" role="region" aria-label="Notifications">
        <div aria-live="polite" aria-atomic="false" style={{ display: "contents" }}>
          {toasts.slice(-3).map((t) => (
            <div className="toast" key={t.id}>
              <Icon name={t.icon} size={16} style={{ color: TONE_COLOR[t.tone] }} aria-hidden />
              <span>{t.message}</span>
              <button
                type="button"
                className="iconbtn sz-28 toast-close"
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
              >
                <Icon name="x" size={14} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): PushToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
