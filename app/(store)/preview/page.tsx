import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollectionTiles, getProducts, getThemeConfig } from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";
import { buildStoreMetadata } from "@/lib/seo";
import { StoreRenderer } from "@/components/sections";

/**
 * Storefront home (DESIGN §5.4) — composed entirely from the home template's sections
 * via the shared `StoreRenderer` against the store's `themeConfig`. Lives at the
 * internal `/preview` route because the apex `/` is the marketing group's; Stage 8's
 * `middleware.ts` rewrites a live store subdomain's `/` here, so the customer sees a
 * clean `/` URL while this composition serves the home.
 */
export async function generateMetadata(): Promise<Metadata> {
  const store = await resolveStorefront();
  if (!store) return {};
  return buildStoreMetadata(store);
}

export default async function StoreHomePage() {
  const store = await resolveStorefront();
  if (!store) notFound();
  const storeId = store._id;

  const [config, products] = await Promise.all([
    getThemeConfig(storeId),
    getProducts(storeId, { status: "active" }),
  ]);
  if (!config) notFound();

  // Refresh the home template's category tiles with LIVE data: a real cover photo
  // and an accurate product count per referenced collection, folded into the section
  // settings before rendering. The theme config persists a stale `count` from
  // authoring time — trusting it hid non-empty categories and left tiles as empty
  // boxes; resolving fresh here means tiles show real photography + counts, and only
  // genuinely empty collections fall away.
  const home = config.templates.home;
  if (home) {
    const handles: string[] = [];
    for (const id of home.sectionOrder ?? []) {
      const sec = home.sections[id];
      if (sec?.type === "collection_list") {
        const cols = (sec.settings as { collections?: { handle?: string }[] }).collections ?? [];
        for (const c of cols) if (c.handle) handles.push(c.handle);
      }
    }
    if (handles.length) {
      const tiles = await getCollectionTiles(storeId, handles);
      for (const id of home.sectionOrder ?? []) {
        const sec = home.sections[id];
        if (sec?.type !== "collection_list") continue;
        const settings = sec.settings as {
          collections?: { handle?: string; image?: string; count?: number }[];
        };
        if (!Array.isArray(settings.collections)) continue;
        settings.collections = settings.collections.map((c) => {
          const tile = c.handle ? tiles[c.handle] : undefined;
          return tile ? { ...c, count: tile.count, image: tile.image } : c;
        });
      }
    }
  }

  return (
    <StoreRenderer
      storeId={storeId}
      config={config}
      template="home"
      products={products}
      currency={store.settings.currency}
      storeName={store.name}
    />
  );
}
