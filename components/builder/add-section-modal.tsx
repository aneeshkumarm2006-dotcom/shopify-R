"use client";

import type { SectionType } from "@/types";
import { Icon, Modal } from "@/components/ui";
import { ADD_SET, SECTION_META } from "./section-catalog";

/**
 * Add-section picker (DESIGN §4.9). Strictly limited to the closed MVP section set
 * (`ADD_SET`) — there is no "custom section" escape hatch (PRD §6.2 closed builder).
 * Picking a type appends a section with sensible defaults and selects it.
 */
export interface AddSectionModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (type: SectionType) => void;
}

export function AddSectionModal({ open, onClose, onAdd }: AddSectionModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Add section" maxWidth={520}>
      <div className="bld-addgrid">
        {ADD_SET.map((type) => {
          const meta = SECTION_META[type];
          return (
            <button
              key={type}
              type="button"
              className="bld-addcard"
              onClick={() => {
                onAdd(type);
                onClose();
              }}
            >
              <span className="bld-addcard-icon">
                <Icon name={meta.icon} size={16} aria-hidden />
              </span>
              <span className="bld-addcard-label">{meta.label}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
