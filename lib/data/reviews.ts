import type { RatingSummary, Review, ReviewStatus } from "@/types";
import { isDbConfigured, Reviews } from "@/lib/db";

/**
 * Product reviews / ratings (Phase 4). New reviews auto-publish (friendlier
 * storefront UX); merchants can hide abusive ones from the moderation table. The
 * aggregate (`summarizeRatings`) is pure for unit testing and reuse on PDP + cards.
 */

/** Average (1-decimal) + count over a set of ratings. Empty → { average: 0, count: 0 }. */
export function summarizeRatings(reviews: Pick<Review, "rating">[]): RatingSummary {
  if (reviews.length === 0) return { average: 0, count: 0 };
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}

/** Clamp/normalize an incoming rating to an integer 1–5. */
export function normalizeRating(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)));
}

export interface ReviewInput {
  productId: string;
  customerId?: string | null;
  authorName: string;
  rating: number;
  title?: string;
  body: string;
}

/** Published reviews for a product, newest first (storefront PDP). */
export async function getProductReviews(
  storeId: string,
  productId: string,
): Promise<Review[]> {
  if (!isDbConfigured()) return [];
  return Reviews.findMany(
    storeId,
    { productId, status: "published" },
    { sort: { createdAt: -1 } },
  );
}

/** Aggregate rating for one product (PDP badge). */
export async function getRatingSummary(
  storeId: string,
  productId: string,
): Promise<RatingSummary> {
  if (!isDbConfigured()) return { average: 0, count: 0 };
  const rows = await Reviews.findMany(storeId, { productId, status: "published" });
  return summarizeRatings(rows);
}

/** Post a review (auto-published). Returns the created row. */
export async function createReview(storeId: string, input: ReviewInput): Promise<Review | null> {
  if (!isDbConfigured()) return null;
  return Reviews.create(storeId, {
    productId: input.productId,
    customerId: input.customerId ?? null,
    authorName: input.authorName.trim().slice(0, 80) || "Anonymous",
    rating: normalizeRating(input.rating),
    title: (input.title ?? "").trim().slice(0, 120),
    body: input.body.trim().slice(0, 2000),
    status: "published",
  });
}

/** All reviews for a store, newest first (admin moderation table). */
export async function listReviews(storeId: string): Promise<Review[]> {
  if (!isDbConfigured()) return [];
  return Reviews.findMany(storeId, {}, { sort: { createdAt: -1 } });
}

export async function setReviewStatus(
  storeId: string,
  id: string,
  status: ReviewStatus,
): Promise<Review | null> {
  if (!isDbConfigured()) return null;
  return Reviews.updateOne(storeId, { _id: id }, { $set: { status } });
}

export async function deleteReview(storeId: string, id: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  return Reviews.deleteOne(storeId, { _id: id });
}
