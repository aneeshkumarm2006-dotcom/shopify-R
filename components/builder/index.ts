/**
 * Store builder (Stage 4 · DESIGN §4.9) — the 3-panel section/block editor. Composes
 * the real Stage 3 sections through the shared `StoreRenderer` (no fork) and writes a
 * valid `themeConfig` in local state; DB persistence arrives in Stage 11.
 */
export { StoreBuilder, type StoreBuilderProps, type DeviceMode, type SaveState } from "./store-builder";
