"use client";

import { useState, useTransition } from "react";
import type { PlatformStoreSummary, StoreStatus, SubscriptionPlan } from "@/types";
import { setStoreStatusAction } from "@/app/(admin)/platform/actions";
import {
  Button,
  Dropdown,
  Eyebrow,
  IconButton,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Modal,
  PageHeader,
  Pill,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { storeStatusPill } from "@/components/admin/shared";
import { fmtDate, storeDomain } from "@/lib/format";

/**
 * Platform admin (DESIGN §4.12) — internal, minimal operator tooling. A cross-tenant
 * table of stores (name · owner · subdomain · status · plan · created) with provision
 / set-plan and suspend (status: suspended → offline) actions. Function over form, but
 * reuses the same primitives. NOT store-scoped by design (PRD §9 / §4.12).
 */
export function PlatformAdmin({ stores }: { stores: PlatformStoreSummary[] }) {
  const toast = useToast();
  const [rows, setRows] = useState(stores);
  const [suspendTarget, setSuspendTarget] = useState<PlatformStoreSummary | null>(null);
  const [reason, setReason] = useState("");
  const [, startTransition] = useTransition();

  /**
   * Persist a status change optimistically: flip the row immediately, then call the
   * platform-admin action (which re-asserts the role server-side). On failure, revert
   * the row and surface the error — so a suspend that didn't actually take the store
   * offline never looks like it succeeded.
   */
  function persistStatus(subdomain: string, status: StoreStatus, successMsg: string) {
    const prev = rows.find((s) => s.subdomain === subdomain)?.status;
    setRows((r) => r.map((s) => (s.subdomain === subdomain ? { ...s, status } : s)));
    startTransition(async () => {
      const res = await setStoreStatusAction(subdomain, status);
      if (res.ok) {
        toast(successMsg, status === "suspended" ? { tone: "critical" } : undefined);
      } else {
        if (prev) {
          setRows((r) => r.map((s) => (s.subdomain === subdomain ? { ...s, status: prev } : s)));
        }
        toast(res.error ?? "Couldn't update the store", { tone: "critical" });
      }
    });
  }
  function setPlan(subdomain: string, plan: SubscriptionPlan) {
    setRows((r) => r.map((s) => (s.subdomain === subdomain ? { ...s, plan } : s)));
    toast(`Plan set to ${plan}`);
  }

  return (
    <div>
      <PageHeader
        title="Platform admin"
        meta="Internal operator tooling — cross-tenant. Handle with care."
        actions={
          <Button
            variant="default"
            icon="plus"
            onClick={() => toast("Manual provisioning is operator-only")}
          >
            Provision merchant
          </Button>
        }
      />

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>{rows.length} stores</Eyebrow>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Store</th>
                <th scope="col">Owner</th>
                <th scope="col">Subdomain</th>
                <th scope="col">Status</th>
                <th scope="col">Plan</th>
                <th scope="col">Created</th>
                <th scope="col" style={{ width: 44 }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const pill = storeStatusPill(s.status);
                return (
                  <tr key={s.subdomain} style={{ cursor: "default" }}>
                    <td>
                      <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>
                        {s.name}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "var(--text-muted)" }}>{s.owner}</span>
                    </td>
                    <td>
                      <span className="mono" style={{ color: "var(--text-muted)" }}>
                        {storeDomain(s.subdomain)}
                      </span>
                    </td>
                    <td>
                      <Pill tone={pill.tone}>{pill.label}</Pill>
                    </td>
                    <td>
                      <span style={{ textTransform: "capitalize" }}>{s.plan}</span>
                    </td>
                    <td>
                      <span style={{ color: "var(--text-muted)" }}>
                        {fmtDate(s.createdAt)}
                      </span>
                    </td>
                    <td className="col-check">
                      <Dropdown
                        trigger={
                          <IconButton
                            name="dots"
                            size={28}
                            aria-label={`Actions for ${s.name}`}
                          />
                        }
                      >
                        {(close) => (
                          <>
                            <MenuLabel>Plan</MenuLabel>
                            <MenuItem
                              icon="tag"
                              onClick={() => {
                                setPlan(s.subdomain, "free");
                                close();
                              }}
                            >
                              Set Free
                            </MenuItem>
                            <MenuItem
                              icon="tag"
                              onClick={() => {
                                setPlan(s.subdomain, "standard");
                                close();
                              }}
                            >
                              Set Standard
                            </MenuItem>
                            <MenuSeparator />
                            {s.status === "suspended" ? (
                              <MenuItem
                                icon="refresh"
                                onClick={() => {
                                  persistStatus(s.subdomain, "live", `${s.name} reinstated`);
                                  close();
                                }}
                              >
                                Reinstate
                              </MenuItem>
                            ) : (
                              <MenuItem
                                icon="lock"
                                danger
                                onClick={() => {
                                  setSuspendTarget(s);
                                  setReason("");
                                  close();
                                }}
                              >
                                Suspend store
                              </MenuItem>
                            )}
                          </>
                        )}
                      </Dropdown>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={suspendTarget !== null}
        onClose={() => setSuspendTarget(null)}
        title={suspendTarget ? `Suspend ${suspendTarget.name}` : "Suspend store"}
        maxWidth={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspendTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="critical-solid"
              onClick={() => {
                if (suspendTarget) {
                  persistStatus(
                    suspendTarget.subdomain,
                    "suspended",
                    `${suspendTarget.name} suspended`,
                  );
                }
                setSuspendTarget(null);
              }}
            >
              Suspend store
            </Button>
          </>
        }
      >
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text)",
            marginBottom: "var(--space-4)",
          }}
        >
          Suspending takes the storefront offline immediately. The merchant keeps dashboard
          access.
        </p>
        <Select
          aria-label="Suspension reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={[
            { value: "", label: "Select a reason…" },
            { value: "policy", label: "Policy violation" },
            { value: "payment", label: "Billing / payment" },
            { value: "abuse", label: "Abuse report" },
            { value: "other", label: "Other" },
          ]}
        />
        <div style={{ height: "var(--space-3)" }} />
        <Textarea placeholder="Internal note (optional)" style={{ minHeight: 60 }} />
      </Modal>
    </div>
  );
}
