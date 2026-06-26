import type { Campaign, CampaignChannel, Segment } from "@/types";
import { isDbConfigured, Campaigns } from "@/lib/db";
import { getStore } from "./store";
import { getCustomers } from "./customers";
import { resolveSegment } from "./segments";
import { sendCampaignEmail } from "@/lib/email";
import { sendSms, isSmsConfigured } from "@/lib/sms";

/**
 * Marketing campaigns (Phase 5) — compose a one-off broadcast to a customer segment
 * and send it over email or SMS. Sending resolves the segment server-side from the
 * store's own customers (never a client list) and tallies deliveries; a campaign can
 * only be sent once (status flips to `sent`).
 */

export interface CampaignInput {
  name: string;
  channel: CampaignChannel;
  segment: Segment;
  subject: string;
  body: string;
}

export async function listCampaigns(storeId: string): Promise<Campaign[]> {
  if (!isDbConfigured()) return [];
  return Campaigns.findMany(storeId, {}, { sort: { createdAt: -1 } });
}

export async function getCampaign(storeId: string, id: string): Promise<Campaign | null> {
  if (!isDbConfigured()) return null;
  return Campaigns.findById(storeId, id);
}

export async function createCampaign(storeId: string, input: CampaignInput): Promise<Campaign> {
  if (!isDbConfigured()) {
    const at = new Date().toISOString();
    return {
      _id: `cmp_${Math.random().toString(36).slice(2, 10)}`,
      storeId,
      ...input,
      status: "draft",
      sentCount: 0,
      sentAt: null,
      createdAt: at,
      updatedAt: at,
    } as Campaign;
  }
  return Campaigns.create(storeId, { ...input, status: "draft", sentCount: 0, sentAt: null });
}

export async function deleteCampaign(storeId: string, id: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  return Campaigns.deleteOne(storeId, { _id: id });
}

/** How many customers a segment currently targets (admin preview before sending). */
export async function countSegment(storeId: string, segment: Segment): Promise<number> {
  const customers = await getCustomers(storeId);
  return resolveSegment(customers, segment).length;
}

export interface SendCampaignResult {
  ok: boolean;
  sentCount: number;
  recipientCount: number;
  error?: string;
}

/**
 * Send a draft campaign. Resolves recipients from the segment, delivers per channel
 * (email always available when Resend is set; SMS gated on `isSmsConfigured()`), then
 * marks the campaign sent with the delivered count. Idempotent guard: a `sent`
 * campaign can't be re-sent.
 */
export async function sendCampaign(storeId: string, id: string): Promise<SendCampaignResult> {
  if (!isDbConfigured()) return { ok: false, sentCount: 0, recipientCount: 0, error: "Campaigns need a database connection." };

  const campaign = await Campaigns.findById(storeId, id);
  if (!campaign) return { ok: false, sentCount: 0, recipientCount: 0, error: "Campaign not found." };
  if (campaign.status === "sent") return { ok: false, sentCount: 0, recipientCount: 0, error: "This campaign was already sent." };

  const store = await getStore(storeId);
  if (!store) return { ok: false, sentCount: 0, recipientCount: 0, error: "Store not found." };

  if (campaign.channel === "sms" && !isSmsConfigured()) {
    return { ok: false, sentCount: 0, recipientCount: 0, error: "SMS isn't configured for this environment." };
  }

  const customers = await getCustomers(storeId);
  const recipients = resolveSegment(customers, campaign.segment);

  let sentCount = 0;
  for (const customer of recipients) {
    if (campaign.channel === "email") {
      const res = await sendCampaignEmail(store, customer.email, campaign.subject, campaign.body);
      if (res.sent) sentCount++;
    } else {
      if (!customer.phone) continue;
      const res = await sendSms({ to: customer.phone, body: campaign.body });
      if (res.sent) sentCount++;
    }
  }

  await Campaigns.updateOne(
    storeId,
    { _id: id },
    { $set: { status: "sent", sentCount, sentAt: new Date().toISOString() } },
  );

  return { ok: true, sentCount, recipientCount: recipients.length };
}
