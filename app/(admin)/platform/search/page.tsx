import type { Metadata } from "next";
import { platformSearch } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformSearch } from "@/components/admin/platform-search";

export const metadata: Metadata = { title: "Search" };

/** Collapse a `searchParam` (string | string[] | undefined) to a single trimmed value. */
function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

export default async function PlatformSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const sp = await searchParams;
  const q = first(sp.q);
  const hits = q ? await platformSearch(q) : [];
  return <PlatformSearch query={q} hits={hits} />;
}
