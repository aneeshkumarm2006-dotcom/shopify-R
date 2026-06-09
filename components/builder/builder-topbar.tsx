"use client";

import type { TemplateKey } from "@/types";
import { Button, Dropdown, Icon, MenuItem } from "@/components/ui";
import type { DeviceMode, SaveState } from "./store-builder";

/**
 * Builder top bar (DESIGN §4.9). Left: exit + which store/template is being edited.
 * Center: the template switcher (home/product/collection/page/cart). Right: the
 * device-width toggle, the autosave indicator, "Save draft", and the single primary
 * Publish action.
 */
export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  home: "Home",
  product: "Product",
  collection: "Collection",
  page: "Page",
  cart: "Cart",
};

const DEVICES: { value: DeviceMode; label: string }[] = [
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
  { value: "mobile", label: "Mobile" },
];

export interface BuilderTopbarProps {
  storeName: string;
  template: TemplateKey;
  onTemplate: (t: TemplateKey) => void;
  device: DeviceMode;
  onDevice: (d: DeviceMode) => void;
  saveState: SaveState;
  onSave: () => void;
  onExit: () => void;
  onPublish: () => void;
}

export function BuilderTopbar({
  storeName,
  template,
  onTemplate,
  device,
  onDevice,
  saveState,
  onSave,
  onExit,
  onPublish,
}: BuilderTopbarProps) {
  return (
    <header className="bld-topbar">
      <div className="bld-topbar-left">
        <Button variant="ghost" size="sm" icon="chevronLeft" onClick={onExit}>
          Exit
        </Button>
        <span className="bld-topbar-divider" aria-hidden />
        <span className="bld-topbar-editing">
          Editing <strong>{storeName}</strong>
        </span>
      </div>

      <div className="bld-topbar-center">
        <Dropdown
          align="left"
          width={200}
          trigger={
            <button type="button" className="btn btn-sm btn-default bld-template-trigger">
              <Icon name="layers" size={14} aria-hidden />
              Template: {TEMPLATE_LABELS[template]}
              <Icon name="chevronDown" size={13} aria-hidden />
            </button>
          }
        >
          {(close) =>
            (Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((key) => (
              <MenuItem
                key={key}
                icon={template === key ? "check" : undefined}
                onClick={() => {
                  onTemplate(key);
                  close();
                }}
              >
                {TEMPLATE_LABELS[key]}
              </MenuItem>
            ))
          }
        </Dropdown>
      </div>

      <div className="bld-topbar-right">
        <div className="bld-segmented bld-device" role="group" aria-label="Preview width">
          {DEVICES.map((d) => (
            <button
              key={d.value}
              type="button"
              className="bld-segment"
              data-active={device === d.value || undefined}
              aria-pressed={device === d.value}
              onClick={() => onDevice(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <span
          className="bld-savestate"
          data-state={saveState}
          role="status"
          aria-live="polite"
        >
          <Icon name={saveState === "saved" ? "check" : "clock"} size={13} aria-hidden />
          {saveState === "saved"
            ? "Saved"
            : saveState === "saving"
              ? "Saving…"
              : "Unsaved changes"}
        </span>

        <Button
          variant="default"
          size="sm"
          onClick={onSave}
          disabled={saveState === "saved"}
        >
          Save draft
        </Button>
        <Button variant="primary" size="sm" iconRight="arrowRight" onClick={onPublish}>
          Publish
        </Button>
      </div>
    </header>
  );
}
