"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@/types";
import { Avatar, EmptyState, NoResultsState, PageHeader } from "@/components/ui";
import { IndexShell } from "@/components/admin/index-shell";
import { fmtDate, money } from "@/lib/format";

/**
 * Customers index (DESIGN §4.8). Per-store list — avatar · name · email · order
 * count · total spent (mono) · joined. Search by name/email. Row → customer detail.
 * Store scope is implicit (no cross-store hint needed).
 */
export function CustomersIndex({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [customers, query]);

  return (
    <div>
      <PageHeader title="Customers" />
      <IndexShell
        tabsLabel="Customers"
        tabs={[{ value: "All", label: "All", count: customers.length }]}
        active="All"
        onTabChange={() => {}}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search by name or email"
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
                      <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>
                        {c.name}
                      </span>
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
