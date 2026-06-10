import type { Section, Template, TemplateKey, ThemeConfig } from "@/types";
import { HOME_CONFIG } from "./mocks";
import { resolve } from "./_util";
import {
  isDbConfigured,
  dbConnect,
  scopedFilter,
  serializeOrNull,
  ThemeConfigModel,
} from "@/lib/db";

/**
 * The store's themeConfig (PRD §5.3) — the object the storefront `StoreRenderer`
 * (Stage 3) and the builder preview (Stage 4) both consume. One per store, read
 * through the tenant scope. Stage 11 adds the write path behind the same shape.
 */
export async function getThemeConfig(storeId: string): Promise<ThemeConfig | null> {
  if (!isDbConfigured()) {
    return HOME_CONFIG.storeId === storeId ? resolve(HOME_CONFIG) : null;
  }
  await dbConnect();
  // Upsert a blank config for stores provisioned before the ThemeConfig seed was added.
  return serializeOrNull<ThemeConfig>(
    await ThemeConfigModel.findOneAndUpdate(
      scopedFilter(storeId),
      { $setOnInsert: { storeId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean(),
  );
}

/** The mutable shape the builder writes back — `storeId`/timestamps are owned server-side. */
export type ThemeConfigInput = {
  templates: Record<TemplateKey, Template>;
  header: Section;
  footer: Section;
};

/**
 * Persist the builder's `themeConfig` (Stage 11, PRD §6.2). One config per store
 * (single-config publish model, PRD §11), so this is an upsert scoped by `storeId`:
 * the builder's autosave and explicit "Save draft" both land here. Only the section
 * tree (`templates`/`header`/`footer`) is writable — `storeId` is forced by the
 * tenant scope and never taken from the client payload, so a merchant can only ever
 * write their own store's theme (PRD §9). Because the live storefront SSRs this same
 * document, a save is immediately reflected on the published store.
 */
export async function saveThemeConfig(
  storeId: string,
  input: ThemeConfigInput,
): Promise<ThemeConfig | null> {
  const $set = {
    templates: input.templates,
    header: input.header,
    footer: input.footer,
  };

  if (!isDbConfigured()) {
    // No DB in Part A: nothing to persist, but echo the merged shape so the caller
    // (and its optimistic UI) can treat the save as authoritative.
    return HOME_CONFIG.storeId === storeId ? resolve({ ...HOME_CONFIG, ...$set }) : null;
  }

  await dbConnect();
  return serializeOrNull<ThemeConfig>(
    await ThemeConfigModel.findOneAndUpdate(
      scopedFilter(storeId),
      { $set },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean(),
  );
}
