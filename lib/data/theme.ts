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

const DEFAULT_HEADER: Section = {
  id: "header",
  type: "header",
  settings: { nav: [], showSearch: true, showCart: true },
  blockOrder: [],
  blocks: {},
};

const DEFAULT_FOOTER: Section = {
  id: "footer",
  type: "footer",
  settings: { columns: [] },
  blockOrder: [],
  blocks: {},
};

const DEFAULT_TEMPLATES: Record<TemplateKey, Template> = {
  home: { sectionOrder: [], sections: {} },
  product: { sectionOrder: [], sections: {} },
  collection: { sectionOrder: [], sections: {} },
  page: { sectionOrder: [], sections: {} },
  cart: { sectionOrder: [], sections: {} },
};

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
  // $setOnInsert seeds header/footer/templates so new stores never have null sections,
  // which would crash the builder and StoreRenderer.
  const doc = await ThemeConfigModel.findOneAndUpdate(
    scopedFilter(storeId),
    {
      $setOnInsert: {
        storeId,
        header: DEFAULT_HEADER,
        footer: DEFAULT_FOOTER,
        templates: DEFAULT_TEMPLATES,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  // Patch stores provisioned before this fix whose header/footer are still null.
  const raw = doc as Record<string, unknown> | null;
  if (raw && (!raw.header || !raw.footer)) {
    const patch: Record<string, unknown> = {};
    if (!raw.header) patch.header = DEFAULT_HEADER;
    if (!raw.footer) patch.footer = DEFAULT_FOOTER;
    if (!raw.templates || Object.keys(raw.templates as object).length === 0) {
      patch.templates = DEFAULT_TEMPLATES;
    }
    return serializeOrNull<ThemeConfig>(
      await ThemeConfigModel.findOneAndUpdate(
        scopedFilter(storeId),
        { $set: patch },
        { new: true },
      ).lean(),
    );
  }

  return serializeOrNull<ThemeConfig>(doc);
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
