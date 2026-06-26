"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Review } from "@/types";
import {
  Button,
  EmptyState,
  Icon,
  Pill,
  PageHeader,
  useToast,
} from "@/components/ui";
import { IndexShell } from "@/components/admin/index-shell";
import { fmtDate } from "@/lib/format";
import { moderateReview, removeReview } from "@/app/(admin)/reviews/actions";

/**
 * Reviews moderation (Phase 4) — every review for the store with hide/restore + delete.
 * Hiding flips status to `hidden` (removed from the storefront, kept for the record);
 * restoring republishes. Auto-published reviews land here for after-the-fact moderation.
 */
export function ReviewsAdmin({
  reviews,
  productTitles,
}: {
  reviews: Review[];
  productTitles: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      All: reviews.length,
      Published: reviews.filter((r) => r.status === "published").length,
      Hidden: reviews.filter((r) => r.status === "hidden").length,
    }),
    [reviews],
  );

  const rows = useMemo(() => {
    let r = reviews;
    if (tab === "Published") r = r.filter((x) => x.status === "published");
    if (tab === "Hidden") r = r.filter((x) => x.status === "hidden");
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (x) =>
          x.authorName.toLowerCase().includes(q) ||
          x.body.toLowerCase().includes(q) ||
          (productTitles[x.productId] ?? "").toLowerCase().includes(q),
      );
    }
    return r;
  }, [reviews, tab, query, productTitles]);

  function hide(r: Review) {
    const next = r.status === "hidden" ? "published" : "hidden";
    startTransition(async () => {
      await moderateReview(r._id, next);
      toast(next === "hidden" ? "Review hidden" : "Review restored");
      router.refresh();
    });
  }
  function destroy(r: Review) {
    startTransition(async () => {
      await removeReview(r._id);
      toast("Review deleted");
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader title="Reviews" />
      <IndexShell
        tabsLabel="Filter reviews"
        tabs={[
          { value: "All", label: "All", count: counts.All },
          { value: "Published", label: "Published", count: counts.Published },
          { value: "Hidden", label: "Hidden", count: counts.Hidden },
        ]}
        active={tab}
        onTabChange={setTab}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search by author, text, or product"
      >
        {reviews.length === 0 ? (
          <EmptyState
            icon="star"
            title="No reviews yet"
            body="Customer reviews from your storefront will show up here for moderation."
          />
        ) : rows.length === 0 ? (
          <p style={{ padding: "var(--space-6)", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
            No reviews match your filter.
          </p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Rating</th>
                <th scope="col">Review</th>
                <th scope="col">Product</th>
                <th scope="col">Status</th>
                <th scope="col" className="col-right">Date</th>
                <th scope="col" style={{ width: 160 }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>
                    <span style={{ display: "inline-flex", gap: 1 }} aria-label={`${r.rating} of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Icon
                          key={n}
                          name="star"
                          size={13}
                          aria-hidden
                          style={{
                            color: n <= r.rating ? "var(--warning)" : "var(--border-strong)",
                            fill: n <= r.rating ? "var(--warning)" : "transparent",
                          }}
                        />
                      ))}
                    </span>
                  </td>
                  <td style={{ maxWidth: 360 }}>
                    {r.title && (
                      <div style={{ fontWeight: 500, color: "var(--text-strong)" }}>{r.title}</div>
                    )}
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.body}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>by {r.authorName}</div>
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
                    {productTitles[r.productId] ?? "—"}
                  </td>
                  <td>
                    {r.status === "hidden" ? (
                      <Pill tone="muted">Hidden</Pill>
                    ) : (
                      <Pill tone="success">Published</Pill>
                    )}
                  </td>
                  <td className="col-right num" style={{ color: "var(--text-muted)" }}>{fmtDate(r.createdAt)}</td>
                  <td className="col-right">
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <Button size="sm" variant="default" onClick={() => hide(r)}>
                        {r.status === "hidden" ? "Restore" : "Hide"}
                      </Button>
                      <Button size="sm" variant="critical" onClick={() => destroy(r)}>
                        Delete
                      </Button>
                    </div>
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
