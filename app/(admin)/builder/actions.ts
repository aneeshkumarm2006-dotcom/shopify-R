"use server";

import { revalidatePath } from "next/cache";
import { saveThemeConfig, type ThemeConfigInput } from "@/lib/data";
import { requireMerchantStoreId, assertNotImpersonating } from "@/lib/auth";

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
): Promise<{ ok: boolean }> {
  const storeId = await requireMerchantStoreId();
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const saved = await saveThemeConfig(storeId, input);
  if (!saved) return { ok: false };
  revalidatePath("/builder");
  revalidatePath("/preview");
  return { ok: true };
}
