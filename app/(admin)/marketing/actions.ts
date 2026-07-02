"use server";

import { revalidatePath } from "next/cache";
import type { CampaignChannel, Segment } from "@/types";
import {
  createCampaign,
  sendCampaign,
  deleteCampaign,
  countSegment,
  recordEvent,
} from "@/lib/data";
import { requirePermission, assertNotImpersonating, getActorUserId } from "@/lib/auth";

/**
 * Marketing campaign actions (Phase 5). storeId resolves server-side; sending fans the
 * message out to the resolved segment (email/SMS) and is guarded against re-sends.
 */

export interface CampaignSaveResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function createCampaignAction(input: {
  name: string;
  channel: CampaignChannel;
  segment: Segment;
  subject: string;
  body: string;
}): Promise<CampaignSaveResult> {
  const storeId = await requirePermission("marketing");
  try { await assertNotImpersonating(); } catch { return { ok: false, error: "Read-only: exit impersonation to make changes." }; }
  if (!input.name.trim()) return { ok: false, error: "Name your campaign." };
  if (!input.body.trim()) return { ok: false, error: "Write a message." };
  if (input.channel === "email" && !input.subject.trim()) {
    return { ok: false, error: "Add an email subject." };
  }
  const created = await createCampaign(storeId, {
    name: input.name.trim(),
    channel: input.channel,
    segment: input.segment,
    subject: input.subject.trim(),
    body: input.body.trim(),
  });
  await recordEvent({
    type: "campaign.created",
    storeId,
    actorUserId: await getActorUserId(),
    target: { kind: "campaign", id: created._id, label: created.name },
  });
  revalidatePath("/marketing");
  return { ok: true, id: created._id };
}

export async function sendCampaignAction(
  id: string,
): Promise<{ ok: boolean; sentCount?: number; recipientCount?: number; error?: string }> {
  const storeId = await requirePermission("marketing");
  try { await assertNotImpersonating(); } catch { return { ok: false, error: "Read-only: exit impersonation to make changes." }; }
  const res = await sendCampaign(storeId, id);
  if (res.ok) {
    await recordEvent({
      type: "campaign.sent",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "campaign", id },
      metadata: { sentCount: res.sentCount, recipientCount: res.recipientCount },
    });
    revalidatePath("/marketing");
  }
  return res.ok
    ? { ok: true, sentCount: res.sentCount, recipientCount: res.recipientCount }
    : { ok: false, error: res.error };
}

export async function deleteCampaignAction(id: string): Promise<{ ok: boolean }> {
  const storeId = await requirePermission("marketing");
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const ok = await deleteCampaign(storeId, id);
  revalidatePath("/marketing");
  return { ok };
}

/** Live recipient count for a segment (admin preview before sending). */
export async function previewSegmentCount(segment: Segment): Promise<number> {
  const storeId = await requirePermission("marketing");
  return countSegment(storeId, segment);
}
