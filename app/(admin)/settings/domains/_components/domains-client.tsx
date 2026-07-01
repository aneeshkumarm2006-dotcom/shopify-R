"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import type { CustomDomain } from "@/types";
import {
  addDomainAction,
  removeDomainAction,
  setPrimaryDomainAction,
  refreshDomainStatusAction,
} from "@/app/(admin)/settings/domains/actions";
import {
  Button,
  Card,
  Field,
  Icon,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Pill,
  type PillTone,
  useToast,
} from "@/components/ui";
import { storeDomain } from "@/lib/format";

/* ── helpers ──────────────────────────────────────────── */

/** Very light client-side shape check (mirrors the server's normalization). */
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

function looksLikeDomain(raw: string): boolean {
  let v = raw.trim().toLowerCase();
  v = v.replace(/^https?:\/\//, "");
  v = v.split("/")[0] ?? v;
  v = v.split(":")[0] ?? v;
  v = v.replace(/\.$/, "");
  return v.length > 0 && v.length <= 253 && DOMAIN_RE.test(v);
}

function verificationTone(status: CustomDomain["verificationStatus"]): PillTone {
  if (status === "verified") return "success";
  if (status === "failed") return "critical";
  return "warning";
}

function verificationLabel(status: CustomDomain["verificationStatus"]): string {
  if (status === "verified") return "Verified";
  if (status === "failed") return "Failed";
  return "Pending DNS";
}

function sslTone(status: CustomDomain["sslStatus"]): PillTone {
  return status === "issued" ? "success" : "muted";
}

function sslLabel(status: CustomDomain["sslStatus"]): string {
  return status === "issued" ? "SSL Active" : "SSL Pending";
}

/* ── polling constants ────────────────────────────────── */

const POLL_INTERVAL_MS = 12_000;
const POLL_MAX = 10;

/* ── props ────────────────────────────────────────────── */

export interface DomainsClientProps {
  initialDomains: CustomDomain[];
  subdomain: string;
}

/* ── component ────────────────────────────────────────── */

export function DomainsClient({ initialDomains, subdomain }: DomainsClientProps) {
  const toast = useToast();
  const [domains, setDomains] = useState<CustomDomain[]>(initialDomains);

  // ── add-domain form ──────────────────────────────────
  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addPending, startAddTransition] = useTransition();
  /** Domain id whose DNS instructions panel is expanded. */
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── remove confirm modal ─────────────────────────────
  const [removeTarget, setRemoveTarget] = useState<CustomDomain | null>(null);
  const [removePending, startRemoveTransition] = useTransition();

  // ── per-domain refresh ──────────────────────────────
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  // ── set-primary ─────────────────────────────────────
  const [primaryPending, startPrimaryTransition] = useTransition();

  // ── polling ──────────────────────────────────────────
  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [polling, setPolling] = useState(false);

  /** True when at least one domain is still pending (determines whether to poll). */
  const hasAnyPending = useCallback(
    (list: CustomDomain[]) =>
      list.some((d) => d.verificationStatus === "pending"),
    [],
  );

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPolling(false);
    pollCountRef.current = 0;
  }, []);

  const schedulePoll = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(async () => {
      pollCountRef.current += 1;
      try {
        const res = await fetch("/api/stores/domains/status");
        if (res.ok) {
          const data = (await res.json()) as { ok: boolean; domains?: CustomDomain[] };
          if (data.ok && Array.isArray(data.domains)) {
            setDomains(data.domains);
            if (!hasAnyPending(data.domains) || pollCountRef.current >= POLL_MAX) {
              stopPolling();
              return;
            }
          }
        }
      } catch {
        // network blip — keep polling
      }
      if (pollCountRef.current < POLL_MAX) {
        schedulePoll();
      } else {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [hasAnyPending, stopPolling]);

  const startPolling = useCallback(() => {
    pollCountRef.current = 0;
    setPolling(true);
    schedulePoll();
  }, [schedulePoll]);

  // Start polling whenever domains change to have a pending entry.
  useEffect(() => {
    if (hasAnyPending(domains) && !pollTimerRef.current) {
      startPolling();
    } else if (!hasAnyPending(domains)) {
      stopPolling();
    }
    return () => {
      // Cleanup on unmount only — don't stop between re-renders.
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restart polling when domains list changes externally.
  useEffect(() => {
    if (hasAnyPending(domains)) {
      if (!pollTimerRef.current) startPolling();
    } else {
      stopPolling();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domains]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // ── handlers ─────────────────────────────────────────

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!looksLikeDomain(addValue)) {
      setAddError("Enter a valid domain, e.g. shop.example.com.");
      return;
    }
    startAddTransition(async () => {
      const res = await addDomainAction({ domain: addValue });
      if (res.ok) {
        setDomains((prev) => {
          // Idempotent: replace if already present, else prepend.
          const exists = prev.some((d) => d._id === res.domain._id);
          return exists
            ? prev.map((d) => (d._id === res.domain._id ? res.domain : d))
            : [res.domain, ...prev];
        });
        setAddValue("");
        setExpandedId(res.domain._id);
        toast("Domain added. Follow the DNS instructions below.", { tone: "success" });
      } else {
        setAddError(res.error ?? "Couldn't add domain.");
      }
    });
  }

  function handleRefresh(domain: CustomDomain) {
    setRefreshingId(domain._id);
    void (async () => {
      const res = await refreshDomainStatusAction(domain._id);
      setRefreshingId(null);
      if (res.ok) {
        setDomains((prev) =>
          prev.map((d) => (d._id === res.domain._id ? res.domain : d)),
        );
        if (res.routingError) {
          // Verified, but the domain won't actually serve the store until routing syncs.
          toast(`Verified, but routing didn't activate: ${res.routingError}`, {
            tone: "critical",
          });
        } else {
          toast(
            res.domain.verificationStatus === "verified"
              ? "Domain verified!"
              : "Status refreshed.",
            { tone: res.domain.verificationStatus === "verified" ? "success" : "info" },
          );
        }
      } else {
        toast(res.error ?? "Couldn't refresh status.", { tone: "critical" });
      }
    })();
  }

  function handleRemoveConfirm() {
    if (!removeTarget) return;
    const id = removeTarget._id;
    const domainName = removeTarget.domain;
    startRemoveTransition(async () => {
      const res = await removeDomainAction(id);
      setRemoveTarget(null);
      if (res.ok) {
        setDomains((prev) => prev.filter((d) => d._id !== id));
        toast(`${domainName} removed.`, { tone: "success" });
      } else {
        toast(res.error ?? "Couldn't remove domain.", { tone: "critical" });
      }
    });
  }

  function handleSetPrimary(domain: CustomDomain) {
    startPrimaryTransition(async () => {
      const res = await setPrimaryDomainAction(domain._id);
      if (res.ok) {
        setDomains((prev) =>
          prev.map((d) => ({
            ...d,
            isPrimary: d._id === domain._id,
          })),
        );
        toast(`${domain.domain} is now the primary domain.`, { tone: "success" });
      } else {
        toast(res.error ?? "Couldn't set primary domain.", { tone: "critical" });
      }
    });
  }

  // ── render ────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Domains"
        meta={
          <span>
            Your storefront is always accessible at{" "}
            <code className="mono" style={{ fontSize: "var(--text-xs)" }}>
              {storeDomain(subdomain)}
            </code>
          </span>
        }
      />

      {polling && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: "var(--space-4)",
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
          }}
        >
          <span
            className="spinner"
            style={{ width: 13, height: 13 }}
            aria-hidden="true"
          />
          Checking DNS…
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
          maxWidth: 760,
        }}
      >
        {/* Add domain card */}
        <Card title="Connect a domain">
          {domains.length === 0 && (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                marginBottom: "var(--space-4)",
              }}
            >
              Connect a domain you own to serve your store there. Visitors to
              your domain will see your storefront directly.
            </p>
          )}
          <form onSubmit={handleAdd} noValidate>
            <Field
              label="Domain"
              error={addError ?? undefined}
            >
              {(p) => (
                <div
                  style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start" }}
                >
                  <Input
                    {...p}
                    type="text"
                    inputMode="url"
                    placeholder="yourdomain.com"
                    value={addValue}
                    onChange={(e) => {
                      setAddValue(e.target.value);
                      if (addError) setAddError(null);
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={addPending}
                    error={!!addError}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    loading={addPending}
                    disabled={!addValue.trim()}
                  >
                    Add domain
                  </Button>
                </div>
              )}
            </Field>
          </form>
        </Card>

        {/* Domains list */}
        {domains.length > 0 && (
          <Card title="Connected domains" pad={false}>
            <ul
              style={{ listStyle: "none", margin: 0, padding: 0 }}
              aria-label="Connected domains"
            >
              {domains.map((domain, i) => (
                <li
                  key={domain._id}
                  style={{
                    borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  <DomainRow
                    domain={domain}
                    expanded={expandedId === domain._id}
                    refreshing={refreshingId === domain._id}
                    primaryPending={primaryPending}
                    onToggleExpand={() =>
                      setExpandedId((prev) =>
                        prev === domain._id ? null : domain._id,
                      )
                    }
                    onRefresh={() => handleRefresh(domain)}
                    onRemove={() => setRemoveTarget(domain)}
                    onSetPrimary={() => handleSetPrimary(domain)}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Remove confirm modal */}
      <Modal
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title="Remove domain"
        maxWidth={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="critical-solid"
              loading={removePending}
              onClick={handleRemoveConfirm}
            >
              Remove {removeTarget?.domain}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text)" }}>
          Removing{" "}
          <strong>{removeTarget?.domain}</strong> will disconnect it from your
          store. DNS records you published at your registrar will need to be
          removed separately.
        </p>
      </Modal>
    </div>
  );
}

/* ── DomainRow ────────────────────────────────────────── */

interface DomainRowProps {
  domain: CustomDomain;
  expanded: boolean;
  refreshing: boolean;
  primaryPending: boolean;
  onToggleExpand: () => void;
  onRefresh: () => void;
  onRemove: () => void;
  onSetPrimary: () => void;
}

function DomainRow({
  domain,
  expanded,
  refreshing,
  primaryPending,
  onToggleExpand,
  onRefresh,
  onRemove,
  onSetPrimary,
}: DomainRowProps) {
  const panelId = `dns-panel-${domain._id}`;
  const isPending = domain.verificationStatus === "pending";
  const isFailed = domain.verificationStatus === "failed";
  const showDnsInstructions = isPending || isFailed || expanded;

  return (
    <div>
      {/* Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-4) var(--space-5)",
          flexWrap: "wrap",
        }}
      >
        {/* Domain name + expand toggle */}
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-controls={panelId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "var(--text-strong)",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
          }}
        >
          <Icon
            name={expanded ? "chevronDown" : "chevronRight"}
            size={14}
            aria-hidden
            style={{ color: "var(--text-muted)", flexShrink: 0 }}
          />
          <span className="mono">{domain.domain}</span>
        </button>

        {/* Status badges */}
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <Pill tone={verificationTone(domain.verificationStatus)}>
            {verificationLabel(domain.verificationStatus)}
          </Pill>
          <Pill tone={sslTone(domain.sslStatus)} dot={false}>
            {sslLabel(domain.sslStatus)}
          </Pill>
          {domain.isPrimary && (
            <Pill tone="info" dot={false}>
              Primary
            </Pill>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          {!domain.isPrimary && domain.verificationStatus === "verified" && (
            <Button
              size="sm"
              variant="default"
              disabled={primaryPending}
              onClick={onSetPrimary}
            >
              Set as primary
            </Button>
          )}
          <IconButton
            name="refresh"
            size={32}
            aria-label={`Refresh status for ${domain.domain}`}
            tip="Refresh status"
            onClick={onRefresh}
            disabled={refreshing}
            className={refreshing ? "spin" : undefined}
          />
          <IconButton
            name="trash"
            size={32}
            aria-label={`Remove ${domain.domain}`}
            tip="Remove domain"
            onClick={onRemove}
            style={{ color: "var(--critical)" }}
          />
        </div>
      </div>

      {/* Error message */}
      {domain.errorMessage && (
        <div
          style={{
            padding: "0 var(--space-5) var(--space-3)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "var(--text-xs)",
            color: "var(--critical)",
          }}
        >
          <Icon name="alertTri" size={13} aria-hidden />
          {domain.errorMessage}
        </div>
      )}

      {/* DNS instructions panel */}
      {showDnsInstructions && (
        <div
          id={panelId}
          role="region"
          aria-label={`DNS instructions for ${domain.domain}`}
          style={{
            margin: "0 var(--space-5) var(--space-4)",
            padding: "var(--space-4)",
            background: "var(--surface-subtle)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <DnsInstructions domain={domain} />
        </div>
      )}
    </div>
  );
}

/* ── DnsInstructions ─────────────────────────────────── */

function DnsInstructions({ domain }: { domain: CustomDomain }) {
  const toast = useToast();

  const intro = domain.isApex
    ? "Add an A record at your registrar pointing to Vercel's IP address."
    : "Add a CNAME record at your registrar pointing to Vercel's edge.";

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast("Copied to clipboard.", { tone: "success", icon: "copy" });
    } catch {
      toast("Couldn't copy — please copy manually.", { tone: "info" });
    }
  }

  if (domain.verificationDetails.length === 0) {
    return (
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--text-muted)",
          margin: 0,
        }}
      >
        DNS instructions will appear here after the domain is registered with
        Vercel. Click &ldquo;Refresh status&rdquo; to fetch them.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--text-strong)",
          margin: 0,
          fontWeight: 500,
        }}
      >
        {intro}
      </p>

      {/* Records table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "var(--text-xs)",
          }}
        >
          <thead>
            <tr>
              {(["Type", "Name", "Value"] as const).map((h) => (
                <th
                  key={h}
                  scope="col"
                  style={{
                    textAlign: "left",
                    padding: "4px 8px 4px 0",
                    color: "var(--text-muted)",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {h}
                </th>
              ))}
              <th
                scope="col"
                style={{
                  width: 32,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span className="sr-only">Copy</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {domain.verificationDetails.map((record, i) => (
              <tr key={i}>
                <td
                  style={{
                    padding: "6px 8px 6px 0",
                    fontFamily: "var(--font-mono, monospace)",
                    fontWeight: 600,
                    color: "var(--text-strong)",
                    whiteSpace: "nowrap",
                    verticalAlign: "top",
                  }}
                >
                  {record.type}
                </td>
                <td
                  style={{
                    padding: "6px 8px 6px 0",
                    fontFamily: "var(--font-mono, monospace)",
                    color: "var(--text)",
                    wordBreak: "break-all",
                    verticalAlign: "top",
                  }}
                >
                  {record.name}
                </td>
                <td
                  style={{
                    padding: "6px 8px 6px 0",
                    fontFamily: "var(--font-mono, monospace)",
                    color: "var(--text)",
                    wordBreak: "break-all",
                    verticalAlign: "top",
                  }}
                >
                  {record.value}
                </td>
                <td style={{ verticalAlign: "top", padding: "4px 0" }}>
                  <IconButton
                    name="copy"
                    size={28}
                    aria-label={`Copy value for ${record.type} record`}
                    tip="Copy value"
                    onClick={() => void copyToClipboard(record.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          margin: 0,
        }}
      >
        <Icon name="clock" size={13} aria-hidden />
        DNS propagation can take up to 48 hours.
      </p>
    </div>
  );
}
