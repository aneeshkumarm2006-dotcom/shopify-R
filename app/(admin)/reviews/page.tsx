import type { Metadata } from "next";
import { listReviews, getProducts } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { ReviewsAdmin } from "@/components/admin/reviews";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const storeId = await requireMerchantStoreId();
  const [reviews, products] = await Promise.all([listReviews(storeId), getProducts(storeId)]);
  const productTitles = Object.fromEntries(products.map((p) => [p._id, p.title]));
  return <ReviewsAdmin reviews={reviews} productTitles={productTitles} />;
}
