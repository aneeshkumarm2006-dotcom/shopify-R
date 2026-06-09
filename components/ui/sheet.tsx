"use client";

import { useId, type ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Overlay } from "./overlay";

/**
 * Sheet (DESIGN §3.7) — right-side slide-in panel. Used for contextual detail and,
 * on the storefront, the cart (see CartSheet). Header (title + close), scrollable
 * body, optional sticky footer.
 */
export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  width?: number;
  dismissable?: boolean;
  children?: ReactNode;
}

export function Sheet({
  open,
  onClose,
  title,
  footer,
  width = 480,
  dismissable = true,
  children,
}: SheetProps) {
  const titleId = useId();
  return (
    <Overlay open={open} onClose={onClose} placement="right" dismissable={dismissable}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        style={{ width, maxWidth: "100vw" }}
      >
        {title && (
          <div className="sheet-header">
            <div className="sheet-title" id={titleId}>
              {title}
            </div>
            <IconButton name="x" size={32} aria-label="Close" onClick={onClose} />
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </Overlay>
  );
}
