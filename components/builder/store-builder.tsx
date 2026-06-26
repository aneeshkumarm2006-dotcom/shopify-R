"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Product,
  Section,
  SectionSettings,
  SectionType,
  TemplateKey,
  ThemeConfig,
} from "@/types";
import { Icon, Modal, Button, ToastProvider, useToast } from "@/components/ui";
import { StoreRenderer } from "@/components/sections";
import type { ThemeVersion } from "@/types";
import {
  saveThemeConfigAction,
  listThemeVersionsAction,
  restoreThemeVersionAction,
} from "@/app/(admin)/builder/actions";
import { fmtDateTime } from "@/lib/format";
import { BuilderTopbar, TEMPLATE_LABELS } from "./builder-topbar";
import { BuilderTree } from "./builder-tree";
import { SectionSettingsPanel } from "./section-settings";
import { AddSectionModal } from "./add-section-modal";
import { defaultSettings, newSectionId } from "./section-catalog";

export type DeviceMode = "desktop" | "tablet" | "mobile";
export type SaveState = "saved" | "saving" | "dirty";

const DEVICE_WIDTH: Record<DeviceMode, number | null> = {
  desktop: null, // fluid — fills the canvas
  tablet: 820,
  mobile: 390,
};

/**
 * Store builder (Stage 4 · DESIGN §4.9) — the section/block editor. Three panels:
 * the structure tree (left), the live `StoreRenderer` preview (center, the SAME
 * renderer the storefront uses), and the contextual settings form (right). Edits run
 * against a local `themeConfig` copy and persist to MongoDB via a debounced autosave +
 * explicit "Save draft" (Stage 11). Below 1600px the settings panel becomes a slide-up
 * sheet over the preview.
 */
export interface StoreBuilderProps {
  storeId: string;
  storeName: string;
  currency: string;
  config: ThemeConfig;
  products: Product[];
}

/**
 * The builder route renders chromeless, so it sits outside the admin shell's
 * `ToastProvider` — supply one here for the save/publish toasts.
 */
export function StoreBuilder(props: StoreBuilderProps) {
  return (
    <ToastProvider>
      <BuilderInner {...props} />
    </ToastProvider>
  );
}

function BuilderInner({
  storeId,
  storeName,
  currency,
  config: initialConfig,
  products,
}: StoreBuilderProps) {
  const router = useRouter();
  const toast = useToast();

  const [config, setConfig] = useState<ThemeConfig>(initialConfig);
  const [template, setTemplate] = useState<TemplateKey>("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [adding, setAdding] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [panelOpen, setPanelOpen] = useState(false); // stacked (<1600px) settings sheet
  const [sheetH, setSheetH] = useState(460); // stacked-sheet height (px), drag-resizable
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  /* The debounced autosave fires off a timer, so it needs the latest config without
     re-creating the timer on every edit — mirror state into a ref. */
  const latestConfig = useRef(initialConfig);
  useEffect(() => {
    latestConfig.current = config;
  }, [config]);

  /* --- stacked settings sheet: drag the grip to resize; drag down to close --- */
  const onGripDown = (e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, startH: sheetH };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onGripMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - e.clientY;
    const max = typeof window !== "undefined" ? window.innerHeight - 120 : 800;
    setSheetH(Math.max(160, Math.min(max, dragRef.current.startH + delta)));
  };
  const onGripUp = (e: React.PointerEvent) => {
    if (dragRef.current && sheetH <= 180) setPanelOpen(false);
    dragRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const tpl = config.templates[template];
  const order = useMemo(() => tpl?.sectionOrder ?? [], [tpl]);
  const orderedSections = useMemo(
    () => order.map((id) => tpl.sections[id]).filter((s): s is Section => Boolean(s)),
    [order, tpl],
  );

  /* --- persistence: write the current themeConfig to MongoDB (Stage 11) --------
     `markDirty` flags unsaved state and schedules a debounced autosave; `persist`
     does the write and drives the save indicator. Both autosave and the explicit
     "Save draft" button share `persist`. The single-config model means a save is
     immediately what the live storefront serves (PRD §11). */
  const persist = useCallback(
    async (reason: "auto" | "manual") => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      setSaveState("saving");
      const cfg = latestConfig.current;
      // An explicit "Save" snapshots the prior config into version history (Phase 6);
      // debounced autosaves don't, to keep the history meaningful + bounded.
      const res = await saveThemeConfigAction(
        {
          templates: cfg.templates,
          header: cfg.header,
          footer: cfg.footer,
        },
        reason === "manual",
      );
      if (res.ok) {
        setSaveState("saved");
        if (reason === "manual") toast("Draft saved");
      } else {
        setSaveState("dirty");
        toast("Couldn't save your changes", { tone: "critical" });
      }
    },
    [toast],
  );

  const markDirty = useCallback(() => {
    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist("auto"), 900);
  }, [persist]);

  /* Flush any pending autosave on unmount so a quick edit-then-leave isn't lost. */
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  /* ----------------------------------------------- selection resolution ---- */
  const selected: Section | null = useMemo(() => {
    if (!selectedId) return null;
    if (selectedId === config.header.id) return config.header;
    if (selectedId === config.footer.id) return config.footer;
    return tpl?.sections[selectedId] ?? null;
  }, [selectedId, config.header, config.footer, tpl]);

  const selectSection = useCallback((id: string) => {
    setSelectedId(id);
    setPanelOpen(true);
  }, []);

  /* ------------------------------------------------- config mutations ------- */
  const updateSettings = useCallback(
    (patch: SectionSettings) => {
      if (!selectedId) return;
      setConfig((prev) => {
        if (selectedId === prev.header.id) {
          return { ...prev, header: { ...prev.header, settings: patch } };
        }
        if (selectedId === prev.footer.id) {
          return { ...prev, footer: { ...prev.footer, settings: patch } };
        }
        const t = prev.templates[template];
        const section = t.sections[selectedId];
        if (!section) return prev;
        return {
          ...prev,
          templates: {
            ...prev.templates,
            [template]: {
              ...t,
              sections: { ...t.sections, [selectedId]: { ...section, settings: patch } },
            },
          },
        };
      });
      markDirty();
    },
    [selectedId, template, markDirty],
  );

  const addSection = useCallback(
    (type: SectionType) => {
      const id = newSectionId();
      const section: Section = {
        id,
        type,
        settings: defaultSettings(type),
        blockOrder: [],
        blocks: {},
      };
      setConfig((prev) => {
        const t = prev.templates[template];
        return {
          ...prev,
          templates: {
            ...prev.templates,
            [template]: {
              ...t,
              sectionOrder: [...t.sectionOrder, id],
              sections: { ...t.sections, [id]: section },
            },
          },
        };
      });
      setSelectedId(id);
      setPanelOpen(true);
      markDirty();
    },
    [template, markDirty],
  );

  const removeSection = useCallback(() => {
    if (!selectedId) return;
    setConfig((prev) => {
      const t = prev.templates[template];
      if (!t.sections[selectedId]) return prev; // header/footer aren't removable
      const sections = { ...t.sections };
      delete sections[selectedId];
      return {
        ...prev,
        templates: {
          ...prev.templates,
          [template]: {
            ...t,
            sectionOrder: t.sectionOrder.filter((x) => x !== selectedId),
            sections,
          },
        },
      };
    });
    setSelectedId(null);
    setPanelOpen(false);
    markDirty();
  }, [selectedId, template, markDirty]);

  const reorder = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= order.length || from === to) return;
      setConfig((prev) => {
        const t = prev.templates[template];
        const next = t.sectionOrder.slice();
        const [m] = next.splice(from, 1);
        if (m === undefined) return prev;
        next.splice(to, 0, m);
        return {
          ...prev,
          templates: { ...prev.templates, [template]: { ...t, sectionOrder: next } },
        };
      });
      markDirty();
    },
    [order.length, template, markDirty],
  );

  const toggleHidden = useCallback((id: string) => {
    setHidden((h) => ({ ...h, [id]: !h[id] }));
  }, []);

  const switchTemplate = useCallback((t: TemplateKey) => {
    setTemplate(t);
    setSelectedId(null);
    setPanelOpen(false);
  }, []);

  /* ------------------------------- preview config (drops hidden sections) --- */
  const previewConfig: ThemeConfig = useMemo(() => {
    const visibleOrder = order.filter((id) => !hidden[id]);
    if (visibleOrder.length === order.length) return config;
    return {
      ...config,
      templates: {
        ...config.templates,
        [template]: { ...tpl, sectionOrder: visibleOrder },
      },
    };
  }, [config, order, hidden, template, tpl]);

  const removable = Boolean(
    selectedId && selectedId !== config.header.id && selectedId !== config.footer.id,
  );

  const frameWidth = DEVICE_WIDTH[device];

  // Version history (Phase 6).
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<ThemeVersion[] | null>(null);
  const openHistory = useCallback(() => {
    setHistoryOpen(true);
    setVersions(null);
    void listThemeVersionsAction().then(setVersions);
  }, []);
  const restore = useCallback(
    (id: string) => {
      void restoreThemeVersionAction(id).then((res) => {
        if (!res.ok) {
          toast("Couldn't restore that version", { tone: "critical" });
          return;
        }
        // Reload so the builder re-initializes from the restored server config.
        window.location.reload();
      });
    },
    [toast],
  );

  return (
    <div className="bld">
      <BuilderTopbar
        storeName={storeName}
        template={template}
        onTemplate={switchTemplate}
        device={device}
        onDevice={setDevice}
        saveState={saveState}
        onSave={() => void persist("manual")}
        onHistory={openHistory}
        onExit={() => router.push("/dashboard")}
        onPublish={() => router.push("/publish")}
      />

      {historyOpen && (
        <Modal open onClose={() => setHistoryOpen(false)} title="Version history">
          {versions === null ? (
            <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Loading…</p>
          ) : versions.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
              No saved versions yet. A snapshot is taken each time you click “Save draft”.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {versions.map((v) => (
                <div
                  key={v._id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "var(--space-3) 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, color: "var(--text-strong)" }}>{v.label}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      {fmtDateTime(v.createdAt)}
                    </div>
                  </div>
                  <Button variant="default" size="sm" onClick={() => restore(v._id)}>
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      <div className="bld-body">
        {/* LEFT — structure tree */}
        <aside className="bld-panel bld-panel-left">
          <BuilderTree
            templateLabel={TEMPLATE_LABELS[template]}
            header={config.header}
            footer={config.footer}
            sections={orderedSections}
            selectedId={selectedId}
            hidden={hidden}
            onSelect={selectSection}
            onToggleHidden={toggleHidden}
            onReorder={reorder}
            onAdd={() => setAdding(true)}
          />
        </aside>

        {/* CENTER — live preview via the shared StoreRenderer */}
        <main className="bld-canvas" data-device={device}>
          <div
            className="bld-frame"
            data-framed={frameWidth != null || undefined}
            style={frameWidth != null ? { width: frameWidth } : undefined}
          >
            <StoreRenderer
              storeId={storeId}
              config={previewConfig}
              template={template}
              mode="preview"
              products={products}
              currency={currency}
              storeName={storeName}
              selectedSectionId={selectedId}
              onSelectSection={selectSection}
            />
            {orderedSections.length === 0 && (
              <div className="bld-canvas-empty">
                <Icon name="layout" size={28} aria-hidden />
                <p>This template has no sections yet.</p>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => setAdding(true)}>
                  <Icon name="plus" size={14} aria-hidden />
                  Add your first section
                </button>
              </div>
            )}
          </div>
        </main>

        {/* RIGHT — contextual settings (slides up as a sheet under 1600px) */}
        <aside
          className="bld-panel bld-panel-right"
          data-open={panelOpen || undefined}
          style={{ ["--bld-sheet-h" as string]: `${sheetH}px` }}
        >
          <div
            className="bld-panel-grip"
            role="separator"
            aria-label="Drag to resize settings panel"
            onPointerDown={onGripDown}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            onDoubleClick={() => setPanelOpen(false)}
          >
            <span className="bld-panel-grip-bar" aria-hidden />
          </div>
          <SectionSettingsPanel
            section={selected}
            products={products}
            onUpdate={updateSettings}
            onRemove={removeSection}
            removable={removable}
          />
        </aside>
      </div>

      <AddSectionModal open={adding} onClose={() => setAdding(false)} onAdd={addSection} />
    </div>
  );
}
