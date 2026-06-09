"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Store } from "@/types";
import {
  Button,
  Card,
  Icon,
  Modal,
  PageHeader,
  Pill,
  Thumb,
  useToast,
} from "@/components/ui";
import { storeStatusPill } from "@/components/admin/shared";
import { PublishDialog } from "@/components/admin/publish-dialog";
import { publishStoreAction, unpublishStoreAction } from "@/app/(admin)/publish/actions";
import { storeDomain } from "@/lib/format";

/**
 * Publish flow screen (DESIGN §4.11). A validation checklist (subdomain required,
 * ≥1 active product recommended, age gate configured), a storefront preview, and
 * publish/unpublish controls. Publishing flips `status: live` + stamps `publishedAt`
 * (stubbed); unpublish reverts to draft. Single-config model — no theme snapshot.
 */
export function Publish({
  store,
  activeProductCount,
}: {
  store: Store;
  activeProductCount: number;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(store.status);
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);

  const pill = storeStatusPill(status);

  function doPublish() {
    startTransition(async () => {
      const res = await publishStoreAction();
      if (res.ok && res.status) {
        setStatus(res.status);
        setPublishOpen(false);
        toast("Store published", { icon: "sparkle" });
        router.refresh();
      } else {
        toast(res.error ?? "Couldn't publish the store", { tone: "critical" });
      }
    });
  }

  function doUnpublish() {
    startTransition(async () => {
      const res = await unpublishStoreAction();
      if (res.ok && res.status) {
        setStatus(res.status);
        setUnpublishOpen(false);
        toast("Store unpublished");
        router.refresh();
      } else {
        toast(res.error ?? "Couldn't unpublish the store", { tone: "critical" });
      }
    });
  }
  const checks = [
    {
      ok: Boolean(store.subdomain),
      label: "Subdomain claimed",
      required: true,
      detail: storeDomain(store.subdomain),
    },
    {
      ok: activeProductCount >= 1,
      label: "At least one active product",
      required: false,
      detail: `${activeProductCount} active`,
    },
    {
      ok: store.ageGate.enabled,
      label: "Age gate configured (21+)",
      required: false,
      detail: store.ageGate.enabled ? "Enabled" : "Disabled",
    },
  ];
  const canPublish = checks.filter((c) => c.required).every((c) => c.ok);

  return (
    <div>
      <PageHeader
        title="Publish"
        pill={<Pill tone={pill.tone}>{pill.label}</Pill>}
        actions={
          status === "live" ? (
            <>
              <Button
                variant="default"
                iconRight="external"
                onClick={() => window.open("/", "_blank")}
              >
                View store
              </Button>
              <Button variant="critical" onClick={() => setUnpublishOpen(true)}>
                Unpublish
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              icon="sparkle"
              disabled={!canPublish}
              onClick={() => setPublishOpen(true)}
            >
              Publish store
            </Button>
          )
        }
      />

      {status === "live" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-4) var(--space-5)",
            background: "var(--success-bg)",
            border: "1px solid color-mix(in oklab, var(--success) 35%, transparent)",
            borderRadius: "var(--radius-lg)",
            marginBottom: "var(--space-5)",
          }}
        >
          <Icon name="check" size={18} style={{ color: "var(--success)" }} aria-hidden />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                color: "var(--text-strong)",
              }}
            >
              Your store is live
            </div>
            <div
              className="mono"
              style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}
            >
              {storeDomain(store.subdomain)}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-5)",
          alignItems: "start",
        }}
      >
        <Card title="Pre-flight checklist">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {checks.map((c) => (
              <div
                key={c.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "var(--radius-sm)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    background: c.ok
                      ? "var(--success-bg)"
                      : c.required
                        ? "var(--critical-bg)"
                        : "var(--warning-bg)",
                    color: c.ok
                      ? "var(--success)"
                      : c.required
                        ? "var(--critical)"
                        : "var(--warning)",
                  }}
                >
                  <Icon name={c.ok ? "check" : "alert"} size={14} aria-hidden />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--text-strong)" }}>
                    {c.label}
                    {c.required && (
                      <span style={{ color: "var(--critical)", marginLeft: 4 }}>*</span>
                    )}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    {c.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              marginTop: "var(--space-4)",
            }}
          >
            <span style={{ color: "var(--critical)" }}>*</span> required. Recommended items
            warn but don’t block publishing.
          </p>
        </Card>

        <Card title="Storefront preview" pad={false}>
          <div
            style={{
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-3)",
            }}
          >
            <Thumb size={120} ratio="16 / 10" icon="store" />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 600, color: "var(--text-strong)" }}>
                {store.name}
              </div>
              <div
                className="mono"
                style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}
              >
                {storeDomain(store.subdomain)}
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              iconRight="external"
              onClick={() => window.open("/", "_blank")}
            >
              Preview storefront
            </Button>
          </div>
        </Card>
      </div>

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        store={store}
        activeProductCount={activeProductCount}
        pending={pending}
        onConfirm={doPublish}
      />

      <Modal
        open={unpublishOpen}
        onClose={() => setUnpublishOpen(false)}
        title="Unpublish store"
        maxWidth={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setUnpublishOpen(false)}>
              Cancel
            </Button>
            <Button variant="critical-solid" loading={pending} onClick={doUnpublish}>
              Unpublish {store.name}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text)" }}>
          <strong>{store.name}</strong> will go offline and its subdomain will stop serving
          until you publish again.
        </p>
      </Modal>
    </div>
  );
}
