import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreOperatorDetail, getEventFeed } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformStoreDetail } from "@/components/admin/platform-store-detail";
import { ImpersonationStartButton } from "@/components/admin/impersonation-start-button";

export const metadata: Metadata = { title: "Store detail" };

export default async function PlatformStoreDetailPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const { storeId } = await params;
  const detail = await getStoreOperatorDetail(storeId);
  if (!detail) notFound();
  const feed = await getEventFeed({ storeId }, 50);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-3)" }}>
        <ImpersonationStartButton storeId={storeId} />
      </div>
      <PlatformStoreDetail detail={detail} feed={feed} />
    </>
  );
}
