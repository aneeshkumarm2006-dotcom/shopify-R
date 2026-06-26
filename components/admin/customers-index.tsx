"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer, SegmentType } from "@/types";
import { Avatar, EmptyState, NoResultsState, PageHeader } from "@/components/ui";
import { IndexShell } from "@/components/admin/index-shell";
import { matchesSegment } from "@/lib/data/segments";
import { fmtDate, money } from "@/lib/format";

/**
 * Customers index (DESIGN §4.8). Per-store list — avatar · name · email · tags · order
 * count · total spent (mono) · joined. Search by name/email/tag, plus segment tabs
 * (Phase 5) that reuse the same segmentation predicates as marketing. Row → detail.
 */
const SEGMENT_TABS: { value: string; label: string; type: SegmentType }[] = [
  { value: "All", label: "All", type: "all" },
  { value: "Ordered", label: "Has ordered", type: "has_ordered" },
  { value: "Prospects", label: "Never ordered", type: "no_orders" },
];

export function CustomersIndex({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All");

  const rows = useMemo(() => {
    const seg = SEGMENT_TABS.find((t) => t.value === tab) ?? SEGMENT_TABS[0]!;
    let r = customers.filter((c) => matchesSegment(c, { type: seg.type }));
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      );
    }
    return r;
  }, [customers, query, tab]);

  return (
    <div>
      <PageHeader title="Customers" />
      <IndexShell
        tabsLabel="Filter customers"
        tabs={SEGMENT_TABS.map((t) => ({
          value: t.value,
          label: t.label,
          count: customers.filter((c) => matchesSegment(c, { type: t.type })).length,
        }))}
        active={tab}
        onTabChange={setTab}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search by name, email, or tag"
        showSort={false}
      >
        {customers.length === 0 ? (
          <EmptyState
            icon="user"
            title="No customers yet"
            body="Customer records are created automatically when an order is placed."
          />
        ) : rows.length === 0 ? (
          <NoResultsState onClear={() => setQuery("")} />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Email</th>
                <th scope="col" className="col-right">
                  Orders
                </th>
                <th scope="col" className="col-right">
                  Total spent
                </th>
                <th scope="col">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c._id}
                  className="is-clickable"
                  onClick={() => router.push(`/customers/${c._id}`)}
                >
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={c.name} size={30} />
                      <div>
                        <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>{c.name}</span>
                        {(c.tags ?? []).length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                            {(c.tags ?? []).slice(0, 4).map((t) => (
                              <span
                                key={t}
                                style={{
                                  fontSize: "var(--text-xs)",
                                  padding: "1px 6px",
                                  borderRadius: 999,
                                  background: "var(--surface-subtle)",
                                  border: "1px solid var(--border)",
                                  color: "var(--text-muted)",
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: "var(--text-muted)" }}>{c.email}</span>
                  </td>
                  <td className="col-right num">{c.orderCount}</td>
                  <td className="col-right num">
                    <span style={{ color: "var(--text-strong)" }}>
                      {money(c.totalSpent)}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: "var(--text-muted)" }}>
                      {fmtDate(c.createdAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </IndexShell>
    </div>
  );
}
