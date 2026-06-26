"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Customer, Order } from "@/types";
import { Avatar, Button, Card, Icon, Input, PageHeader, Pill, useToast } from "@/components/ui";
import { fulfillmentPill, paymentPill } from "@/components/admin/shared";
import { normalizeTag } from "@/lib/data/segments";
import { updateCustomerTags } from "@/app/(admin)/customers/actions";
import { fmtDate, money } from "@/lib/format";

/**
 * Customer detail (DESIGN §4.8) — header (name + contact), denormalized stats
 * (orders, total spent), order history, and saved addresses. Denormalized totals
 * mirror PRD §5.9; order history links into each order's detail.
 */
export function CustomerDetail({
  customer,
  orders,
}: {
  customer: Customer;
  orders: Order[];
}) {
  const router = useRouter();

  return (
    <div>
      <PageHeader
        breadcrumb={
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ padding: "0 6px", marginLeft: -6, color: "var(--text-muted)" }}
            onClick={() => router.push("/customers")}
          >
            <Icon name="chevronLeft" size={15} aria-hidden /> Customers
          </button>
        }
        title={
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={customer.name} size={32} />
            {customer.name}
          </span>
        }
        meta={
          <span>
            <span style={{ color: "var(--info)" }}>{customer.email}</span>
            {customer.phone && (
              <>
                {" "}
                · <span className="mono">{customer.phone}</span>
              </>
            )}{" "}
            · Joined {fmtDate(customer.createdAt)}
          </span>
        }
      />

      {/* Denormalized stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-4)",
          marginBottom: "var(--space-5)",
        }}
      >
        <Card>
          <div className="stat-label">Orders</div>
          <div className="stat-value mono">{customer.orderCount}</div>
        </Card>
        <Card>
          <div className="stat-label">Total spent</div>
          <div className="stat-value mono">{money(customer.totalSpent)}</div>
        </Card>
        <Card>
          <div className="stat-label">Saved addresses</div>
          <div className="stat-value mono">{customer.addresses.length}</div>
        </Card>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gap: "var(--space-5)",
          alignItems: "start",
        }}
      >
        {/* Order history */}
        <Card title="Order history" pad={false}>
          {orders.length === 0 ? (
            <div
              style={{
                padding: "var(--space-6)",
                color: "var(--text-muted)",
                fontSize: "var(--text-sm)",
              }}
            >
              No orders yet.
            </div>
          ) : (
            orders.map((o) => {
              const pp = paymentPill(o.paymentStatus);
              const fp = fulfillmentPill(o.fulfillmentStatus);
              return (
                <Link key={o._id} href={`/orders/${o._id}`} className="list-row">
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-strong)",
                      width: 52,
                    }}
                  >
                    #{o.orderNumber}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: "var(--text-sm)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {fmtDate(o.createdAt)}
                  </span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <Pill tone={pp.tone}>{pp.label}</Pill>
                    <Pill tone={fp.tone}>{fp.label}</Pill>
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-strong)",
                      width: 72,
                      textAlign: "right",
                    }}
                  >
                    {money(o.total)}
                  </span>
                </Link>
              );
            })
          )}
        </Card>

        {/* Right column: tags + saved addresses */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <TagEditor customerId={customer._id} initial={customer.tags ?? []} />
        <Card title="Saved addresses" pad={false}>
          {customer.addresses.length === 0 ? (
            <div
              style={{
                padding: "var(--space-6)",
                color: "var(--text-muted)",
                fontSize: "var(--text-sm)",
              }}
            >
              No saved addresses.
            </div>
          ) : (
            customer.addresses.map((a, i) => (
              <div
                key={i}
                style={{
                  padding: "var(--space-4) var(--space-6)",
                  borderTop: i ? "1px solid var(--border)" : "none",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}
                >
                  <Icon
                    name="mapPin"
                    size={14}
                    style={{ color: "var(--text-muted)" }}
                    aria-hidden
                  />
                  <span
                    style={{
                      fontWeight: 500,
                      color: "var(--text-strong)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {a.name}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--text)",
                    lineHeight: 1.5,
                  }}
                >
                  {a.address}
                </div>
                {a.phone && (
                  <div
                    className="mono"
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-muted)",
                      marginTop: 4,
                    }}
                  >
                    {a.phone}
                  </div>
                )}
              </div>
            ))
          )}
        </Card>
        </div>
      </div>
    </div>
  );
}

/** Segmentation-tag editor (Phase 5) — add/remove tags used by marketing segments. */
function TagEditor({ customerId, initial }: { customerId: string; initial: string[] }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [tags, setTags] = useState<string[]>(initial);
  const [input, setInput] = useState("");

  function save(next: string[]) {
    startTransition(async () => {
      const res = await updateCustomerTags(customerId, next);
      if (!res.ok) {
        toast(res.error ?? "Couldn't update tags", { tone: "critical" });
        return;
      }
      setTags(res.tags ?? next);
    });
  }
  function add() {
    const tag = normalizeTag(input);
    if (!tag || tags.includes(tag)) {
      setInput("");
      return;
    }
    const next = [...tags, tag];
    setInput("");
    save(next);
  }
  function remove(tag: string) {
    save(tags.filter((t) => t !== tag));
  }

  return (
    <Card title="Tags">
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "var(--space-3)" }}>
          {tags.map((t) => (
            <span
              key={t}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
                fontSize: "var(--text-xs)",
                border: "1px solid var(--border)",
                borderRadius: 999,
                background: "var(--surface-subtle)",
                color: "var(--text-strong)",
              }}
            >
              {t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => remove(t)}
                disabled={pending}
                style={{ border: "none", background: "none", cursor: "pointer", lineHeight: 0, color: "var(--text-muted)" }}
              >
                <Icon name="x" size={12} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a tag…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="default" onClick={add} loading={pending} disabled={!input.trim()}>
          Add
        </Button>
      </div>
    </Card>
  );
}
