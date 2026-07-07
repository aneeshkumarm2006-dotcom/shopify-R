import type { Page, PageInput } from "@/types";
import { isDbConfigured, Pages } from "@/lib/db";

/**
 * Content pages (About, Contact, FAQ, policies, …) — the merchant CMS Shopify calls
 * "Pages" (Online Store → Pages). Previously this platform had no such feature: every
 * `/pages/<handle>` URL rendered one shared generic themeConfig template regardless of
 * handle, so an About page and a Contact page were identical. Each `Page` here is its
 * own record with its own title/body/visibility, keyed by a per-store-unique handle.
 */
export type { PageInput } from "@/types";

export async function getPages(storeId: string): Promise<Page[]> {
  if (!isDbConfigured()) return [];
  return Pages.findMany(storeId, {}, { sort: { title: 1 } });
}

/** A single page by Mongo id, scoped to the store (admin editor). */
export async function getPageById(storeId: string, id: string): Promise<Page | null> {
  if (!isDbConfigured()) return null;
  return Pages.findById(storeId, id);
}

/** A visible page by handle (storefront) — hidden pages 404 like a missing page. */
export async function getPageByHandle(storeId: string, handle: string): Promise<Page | null> {
  if (!isDbConfigured()) return null;
  const page = await Pages.findOne(storeId, { handle });
  return page && page.status === "visible" ? page : null;
}

export async function createPage(storeId: string, input: PageInput): Promise<Page> {
  if (!isDbConfigured()) throw new Error("Pages need a database connection.");
  try {
    return await Pages.create(storeId, { ...input, status: input.status ?? "visible", seo: input.seo ?? {} });
  } catch (err) {
    throw mapPageHandleClash(err);
  }
}

export async function updatePage(storeId: string, id: string, input: PageInput): Promise<Page | null> {
  if (!isDbConfigured()) return null;
  try {
    return await Pages.updateOne(storeId, { _id: id }, { $set: { ...input } });
  } catch (err) {
    throw mapPageHandleClash(err);
  }
}

export async function deletePage(storeId: string, id: string): Promise<boolean> {
  if (!isDbConfigured()) return true;
  return Pages.deleteOne(storeId, { _id: id });
}

function mapPageHandleClash(err: unknown): Error {
  if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
    return new Error("HANDLE_TAKEN");
  }
  return err instanceof Error ? err : new Error("Page write failed");
}
