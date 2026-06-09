"use client";

import { useId, type ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Overlay } from "./overlay";

/**
 * Modal (DESIGN §3.7) — centered dialog, scrim + Esc + scrim-click close.
 * max-w 480 (confirm) / 640 (form). Destructive confirms should name the object
 * and put the dangerous verb on the right in `--critical` (see ConfirmModal).
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
  dismissable?: boolean;
  children?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  footer,
  maxWidth = 480,
  dismissable = true,
  children,
}: ModalProps) {
  const titleId = useId();
  return (
    <Overlay open={open} onClose={onClose} dismissable={dismissable}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        style={{ maxWidth }}
      >
        {title && (
          <div className="card-header">
            <div className="card-title" id={titleId}>
              {title}
            </div>
            <IconButton name="x" size={32} aria-label="Close" onClick={onClose} />
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </Overlay>
  );
}
