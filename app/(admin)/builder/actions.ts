"use server";

import { revalidatePath } from "next/cache";
import {
  saveThemeConfig,
  listThemeVersions,
  restoreThemeVersion,
  recordEvent,
  type ThemeConfigInput,
} from "@/lib/data";
import type { ThemeVersion } from "@/types";
import { requireMerchantStoreId, assertNotImpersonating, getActorUserId } from "@/lib/auth";

/**
 * Builder persistence action (Stage 11, PRD §6.2). Both the autosave debounce and
 * the explicit "Save draft" button call this with the current `themeConfig` section
 * tree. The `storeId` is resolved from the session server-side — never trusted from
 * the client — so a merchant can only write their own store's theme (PRD §9).
 *
 * Single-config publish model (PRD §11): there's no draft/live split for the theme,
 * so a save immediately becomes what a live storefront SSRs. We revalidate the
 * builder route (fresh server config on next visit) and the storefront home.
 */
export async function saveThemeConfigAction(
  input: ThemeConfigInput,
  /** When true (explicit "Save"), snapshot the prior config into version history. */
  snapshot = false,
): Promise<{ ok: boolean }> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const saved = await saveThemeConfig(storeId, input, { snapshot });
  if (!saved) return { ok: false };
  revalidatePath("/builder");
  revalidatePath("/preview");
  return { ok: true };
}

/** List the store's saved theme versions (Phase 6 history panel). */
export async function listThemeVersionsAction(): Promise<ThemeVersion[]> {
  const storeId = await requireMerchantStoreId();
  return listThemeVersions(storeId);
}

/** Restore a past theme version into the live config (Phase 6). */
export async function restoreThemeVersionAction(
  versionId: string,
): Promise<{ ok: boolean }> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const restored = await restoreThemeVersion(storeId, versionId);
  if (!restored) return { ok: false };
  await recordEvent({
    type: "theme.restored",
    storeId,
    actorUserId: await getActorUserId(),
    target: { kind: "theme", id: versionId },
  });
  revalidatePath("/builder");
  revalidatePath("/preview");
  return { ok: true };
}
