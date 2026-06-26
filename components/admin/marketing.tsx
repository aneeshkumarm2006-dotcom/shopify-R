"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Campaign, CampaignChannel, Segment, SegmentType } from "@/types";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pill,
  useToast,
} from "@/components/ui";
import { segmentLabel } from "@/lib/data/segments";
import { fmtDate } from "@/lib/format";
import {
  createCampaignAction,
  sendCampaignAction,
  deleteCampaignAction,
  previewSegmentCount,
} from "@/app/(admin)/marketing/actions";

/**
 * Marketing admin (Phase 5) — compose a campaign to a customer segment and broadcast it
 * over email or SMS, plus a history of past sends. The recipient count previews live as
 * the segment changes (resolved server-side from the store's own customers).
 */
export function MarketingAdmin({
  campaigns,
  tags,
  customerCount,
  smsEnabled,
}: {
  campaigns: Campaign[];
  tags: string[];
  customerCount: number;
  smsEnabled: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("email");
  const [segType, setSegType] = useState<SegmentType>("all");
  const [segValue, setSegValue] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [count, setCount] = useState<number | null>(customerCount);

  const segment: Segment = { type: segType, ...(segValue ? { value: segValue } : {}) };

  // Live recipient-count preview whenever the segment changes.
  useEffect(() => {
    let active = true;
    previewSegmentCount({ type: segType, ...(segValue ? { value: segValue } : {}) }).then((n) => {
      if (active) setCount(n);
    });
    return () => {
      active = false;
    };
  }, [segType, segValue]);

  function create(thenSend: boolean) {
    startTransition(async () => {
      const res = await createCampaignAction({ name, channel, segment, subject, body });
      if (!res.ok || !res.id) {
        toast(res.error ?? "Couldn't save the campaign", { tone: "critical" });
        return;
      }
      if (thenSend) {
        const sent = await sendCampaignAction(res.id);
        if (!sent.ok) {
          toast(sent.error ?? "Saved as draft, but sending failed", { tone: "critical" });
        } else {
          toast(`Sent to ${sent.sentCount} of ${sent.recipientCount} recipients`);
        }
      } else {
        toast("Campaign saved as draft");
      }
      setName("");
      setSubject("");
      setBody("");
      router.refresh();
    });
  }

  function send(c: Campaign) {
    startTransition(async () => {
      const res = await sendCampaignAction(c._id);
      if (!res.ok) {
        toast(res.error ?? "Couldn't send", { tone: "critical" });
        return;
      }
      toast(`Sent to ${res.sentCount} of ${res.recipientCount} recipients`);
      router.refresh();
    });
  }

  function destroy(c: Campaign) {
    startTransition(async () => {
      await deleteCampaignAction(c._id);
      toast("Campaign deleted");
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader title="Marketing" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)", alignItems: "start" }}>
        {/* Composer */}
        <Card title="New campaign">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field label="Campaign name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring promo" />
            </Field>

            <Field label="Channel">
              <div style={{ display: "flex", gap: 6 }}>
                {(["email", "sms"] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    aria-pressed={channel === ch}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      border: `1px solid ${channel === ch ? "var(--accent)" : "var(--border)"}`,
                      background: channel === ch ? "var(--info-bg)" : "transparent",
                      color: "var(--text-strong)",
                      fontWeight: 500,
                    }}
                  >
                    {ch === "email" ? "Email" : "SMS"}
                  </button>
                ))}
              </div>
              {channel === "sms" && !smsEnabled && (
                <p style={{ marginTop: 6, fontSize: "var(--text-xs)", color: "var(--warning)" }}>
                  SMS is not configured in this environment — sending will be unavailable.
                </p>
              )}
            </Field>

            <Field label="Audience">
              <div style={{ display: "flex", gap: 6 }}>
                <select
                  className="input"
                  value={segType}
                  onChange={(e) => setSegType(e.target.value as SegmentType)}
                >
                  <option value="all">All customers</option>
                  <option value="tag">Tagged…</option>
                  <option value="has_ordered">Has ordered</option>
                  <option value="no_orders">Never ordered</option>
                  <option value="min_spent">Spent at least…</option>
                </select>
                {segType === "tag" && (
                  <select className="input" value={segValue} onChange={(e) => setSegValue(e.target.value)}>
                    <option value="">Pick a tag</option>
                    {tags.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
                {segType === "min_spent" && (
                  <Input mono value={segValue} onChange={(e) => setSegValue(e.target.value)} placeholder="100" />
                )}
              </div>
              <p style={{ marginTop: 6, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                {count === null ? "…" : count} recipient{count === 1 ? "" : "s"}
              </p>
            </Field>

            {channel === "email" && (
              <Field label="Subject">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line" />
              </Field>
            )}

            <Field label="Message">
              <textarea
                className="input"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={channel === "email" ? "Your email body… (blank lines become paragraphs)" : "Your SMS text…"}
                style={{ resize: "vertical", minHeight: 110, padding: 12 }}
              />
            </Field>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="default" onClick={() => create(false)} loading={pending}>
                Save draft
              </Button>
              <Button
                variant="primary"
                onClick={() => create(true)}
                loading={pending}
                disabled={channel === "sms" && !smsEnabled}
              >
                Send now
              </Button>
            </div>
          </div>
        </Card>

        {/* History */}
        <Card title="Campaigns">
          {campaigns.length === 0 ? (
            <EmptyState icon="mail" title="No campaigns yet" body="Compose your first broadcast on the left." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {campaigns.map((c) => (
                <div
                  key={c._id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "var(--space-3) 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, color: "var(--text-strong)" }}>{c.name}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      {c.channel.toUpperCase()} · {segmentLabel(c.segment)}
                      {c.status === "sent" && ` · ${c.sentCount ?? 0} sent ${c.sentAt ? `· ${fmtDate(c.sentAt)}` : ""}`}
                    </div>
                  </div>
                  {c.status === "sent" ? (
                    <Pill tone="success">Sent</Pill>
                  ) : (
                    <>
                      <Button size="sm" variant="primary" onClick={() => send(c)}>
                        Send
                      </Button>
                      <Button size="sm" variant="ghost" icon="trash" aria-label="Delete" onClick={() => destroy(c)} />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
