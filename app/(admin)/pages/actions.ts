"use server";

import { revalidatePath } from "next/cache";
import { createPage, updatePage, deletePage, recordEvent, type PageInput } from "@/lib/data";
import { requirePermission, assertNotImpersonating, getActorUserId } from "@/lib/auth";

/**
 * Server actions for the content-pages admin (Online Store → Pages). Each page is its
 * own record (title/body/visibility), unlike the single shared themeConfig "page"
 * template. storeId is resolved server-side (tenant isolation, PRD §9).
 */

export interface PageSaveResult {
  ok: boolean;
  id?: string;
  error?: string;
}

function revalidatePages(handle?: string) {
  revalidatePath("/pages");
  if (handle) revalidatePath(`/pages/${handle}`);
}

export async function savePage(id: string | null, input: PageInput): Promise<PageSaveResult> {
  const storeId = await requirePermission("content");
  try {
    await assertNotImpersonating();
  } catch {
    return { ok: false, error: "Read-only: exit impersonation to make changes." };
  }
  if (!input.title.trim()) return { ok: false, error: "Add a page title." };
  if (!input.handle.trim()) return { ok: false, error: "Add a handle." };
  try {
    if (id) {
      const updated = await updatePage(storeId, id, input);
      if (!updated) return { ok: false, error: "Page not found." };
      await recordEvent({
        type: "page.updated",
        storeId,
        actorUserId: await getActorUserId(),
        target: { kind: "page", id, label: input.title },
      });
      revalidatePages(input.handle);
      return { ok: true, id };
    }
    const created = await createPage(storeId, input);
    await recordEvent({
      type: "page.created",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "page", id: created._id, label: input.title },
    });
    revalidatePages(input.handle);
    return { ok: true, id: created._id };
  } catch (err) {
    if (err instanceof Error && err.message === "HANDLE_TAKEN") {
      return { ok: false, error: "That handle is already used by another page." };
    }
    return { ok: false, error: "Couldn't save the page. Please try again." };
  }
}

export async function removePage(id: string): Promise<{ ok: boolean }> {
  const storeId = await requirePermission("content");
  try {
    await assertNotImpersonating();
  } catch {
    return { ok: false };
  }
  const ok = await deletePage(storeId, id);
  if (ok) {
    await recordEvent({
      type: "page.deleted",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "page", id },
    });
  }
  revalidatePages();
  return { ok };
}
