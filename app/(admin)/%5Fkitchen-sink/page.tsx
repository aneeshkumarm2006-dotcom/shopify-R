import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomers, getOrders, getProducts } from "@/lib/data";
import { MOCK_STORE_ID } from "@/lib/data/mocks";
import { KitchenSink } from "@/components/dev/kitchen-sink";

export const metadata: Metadata = { title: "Kitchen sink" };

/**
 * Stage 1 `/_kitchen-sink` — every shared UI primitive in every state, light + dark
 * (DESIGN §3). This is the ⏸ CHECKPOINT review surface before Stage 2.
 *
 * Server component: pulls demo data ONLY from the stub data-access seams (the same
 * source every Part-A screen uses) and hands it to the interactive client gallery.
 */
export default async function KitchenSinkPage() {
  // Dev-only design review surface — never expose it on a production deployment.
  if (process.env.NODE_ENV === "production") notFound();

  const [products, orders, customers] = await Promise.all([
    getProducts(MOCK_STORE_ID),
    getOrders(MOCK_STORE_ID),
    getCustomers(MOCK_STORE_ID),
  ]);

  return <KitchenSink products={products} orders={orders} customers={customers} />;
}
