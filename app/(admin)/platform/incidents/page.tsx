import type { Metadata } from "next";
import { getNeedsAttention, getErrors } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformIncidents } from "@/components/admin/platform-incidents";
import type { ErrorSeverity } from "@/types";

export const metadata: Metadata = { title: "Incidents" };

const SEVERITIES: readonly ErrorSeverity[] = ["info", "warning", "error", "critical"];

/** Collapse a `searchParam` (string | string[] | undefined) to a single trimmed value. */
function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

export default async function PlatformIncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const sp = await searchParams;

  const status = first(sp.status) === "resolved" ? "resolved" : "open";
  const severityRaw = first(sp.severity);
  const severity = SEVERITIES.includes(severityRaw as ErrorSeverity)
    ? (severityRaw as ErrorSeverity)
    : undefined;

  const [needs, errors] = await Promise.all([
    getNeedsAttention(),
    getErrors({ resolved: status === "resolved", severity }, 100),
  ]);

  return (
    <PlatformIncidents
      needs={needs}
      errors={errors}
      status={status}
      severity={severity}
    />
  );
}
