import type { Customer, Segment } from "@/types";

/**
 * Customer segmentation (Phase 5) — pure predicates so campaign targeting + the
 * customers-index filter share one definition and it's unit-testable without a DB.
 * A segment narrows the store's customers; `all` is everyone.
 */

/** Does a customer belong to a segment? */
export function matchesSegment(customer: Customer, segment: Segment): boolean {
  switch (segment.type) {
    case "all":
      return true;
    case "tag":
      return (customer.tags ?? []).some(
        (t) => t.toLowerCase() === (segment.value ?? "").trim().toLowerCase(),
      );
    case "has_ordered":
      return customer.orderCount > 0;
    case "no_orders":
      return customer.orderCount === 0;
    case "min_spent": {
      const threshold = Number(segment.value);
      return Number.isFinite(threshold) && customer.totalSpent >= threshold;
    }
    default:
      return false;
  }
}

/** Filter a customer list to a segment, preserving order. */
export function resolveSegment(customers: Customer[], segment: Segment): Customer[] {
  return customers.filter((c) => matchesSegment(c, segment));
}

/** A short human label for a segment (admin display). */
export function segmentLabel(segment: Segment): string {
  switch (segment.type) {
    case "all":
      return "All customers";
    case "tag":
      return `Tagged “${segment.value || "—"}”`;
    case "has_ordered":
      return "Has ordered";
    case "no_orders":
      return "Never ordered";
    case "min_spent":
      return `Spent ≥ ${segment.value || "0"}`;
    default:
      return "Segment";
  }
}

/** Normalize a free-form tag (lowercase, trimmed, spaces→hyphens) for consistent matching. */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 32);
}
