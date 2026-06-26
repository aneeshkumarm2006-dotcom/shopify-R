"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RatingSummary, Review } from "@/types";
import { Icon } from "@/components/ui/icon";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import { useStorefront } from "./storefront-context";
import { submitReview } from "@/app/(store)/actions";

/** Read-only star row (filled to `value`, rounded to nearest half is overkill — round). */
export function StarRating({ value, size = 15 }: { value: number; size?: number }) {
  const filled = Math.round(value);
  return (
    <span style={{ display: "inline-flex", gap: 1 }} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          size={size}
          aria-hidden
          style={{
            color: n <= filled ? "var(--warning)" : "var(--border-strong)",
            fill: n <= filled ? "var(--warning)" : "transparent",
          }}
        />
      ))}
    </span>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div style={{ display: "inline-flex", gap: 2 }} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-pressed={value === n}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          style={{ background: "none", border: "none", padding: 2, cursor: "pointer", lineHeight: 0 }}
        >
          <Icon
            name="star"
            size={26}
            aria-hidden
            style={{
              color: n <= shown ? "var(--warning)" : "var(--border-strong)",
              fill: n <= shown ? "var(--warning)" : "transparent",
            }}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * Product reviews (Phase 4) — aggregate header, the published list, and a write-a-review
 * form that posts through the `submitReview` server action (which binds a signed-in
 * shopper's identity server-side). Refreshes on success so the new review appears.
 */
export function ProductReviews({
  handle,
  summary,
  reviews,
}: {
  handle: string;
  summary: RatingSummary;
  reviews: Review[];
}) {
  const sf = useStorefront();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    rating: 0,
    authorName: sf?.customer?.name ?? "",
    title: "",
    body: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitReview({
        handle,
        rating: form.rating,
        authorName: form.authorName,
        title: form.title,
        body: form.body,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't post your review.");
        return;
      }
      setDone(true);
      setOpen(false);
      setForm({ rating: 0, authorName: sf?.customer?.name ?? "", title: "", body: "" });
      router.refresh();
    });
  }

  return (
    <section style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "var(--text-xl)", color: "var(--warm-900)" }}>
            Reviews
          </h2>
          {summary.count > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--warm-600)" }}>
              <StarRating value={summary.average} />
              <span className="mono" style={{ fontSize: "var(--text-sm)" }}>
                {summary.average.toFixed(1)} · {summary.count} review{summary.count === 1 ? "" : "s"}
              </span>
            </span>
          )}
        </div>
        {!open && (
          <Button variant="default" onClick={() => { setOpen(true); setDone(false); }}>
            Write a review
          </Button>
        )}
      </div>

      {done && (
        <p style={{ marginTop: 14, fontSize: "var(--text-sm)", color: "var(--success)" }}>
          Thanks — your review is published.
        </p>
      )}

      {open && (
        <form
          onSubmit={submit}
          style={{
            marginTop: 20,
            padding: "var(--space-6)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--warm-0)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            maxWidth: 560,
          }}
        >
          <Field label="Your rating">
            <StarInput value={form.rating} onChange={(rating) => setForm((f) => ({ ...f, rating }))} />
          </Field>
          {!sf?.customer && (
            <Field label="Name">
              <Input
                required
                value={form.authorName}
                onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
              />
            </Field>
          )}
          <Field label="Headline" help="Optional">
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="Review">
            <textarea
              required
              rows={4}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              className="input"
              style={{ resize: "vertical", minHeight: 90, padding: 12 }}
            />
          </Field>
          {error && (
            <p role="alert" style={{ fontSize: "var(--text-sm)", color: "var(--critical)" }}>
              {error}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              Post review
            </Button>
          </div>
        </form>
      )}

      {/* List */}
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        {reviews.length === 0 ? (
          <p style={{ color: "var(--warm-600)", fontSize: "var(--text-base)" }}>
            No reviews yet — be the first to share what you think.
          </p>
        ) : (
          reviews.map((r) => (
            <div key={r._id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <StarRating value={r.rating} size={13} />
                <span style={{ fontWeight: 600, color: "var(--warm-900)", fontSize: "var(--text-sm)" }}>
                  {r.authorName}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>{fmtDate(r.createdAt)}</span>
              </div>
              {r.title && (
                <div style={{ fontWeight: 600, color: "var(--warm-900)", marginBottom: 4 }}>{r.title}</div>
              )}
              <p style={{ fontSize: "var(--text-base)", lineHeight: 1.6, color: "var(--text)" }}>{r.body}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
