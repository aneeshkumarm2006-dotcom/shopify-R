import type { Metadata } from "next";
import { getProducts } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { ProductsIndex } from "@/components/admin/products-index";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const products = await getProducts(await requireMerchantStoreId());
  return <ProductsIndex products={products} />;
}
