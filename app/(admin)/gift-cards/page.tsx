import type { Metadata } from "next";
import { listGiftCards, getStore } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { storeCurrency } from "@/lib/format";
import { GiftCardsAdmin } from "@/components/admin/gift-cards";

export const metadata: Metadata = { title: "Gift Cards" };

export default async function GiftCardsPage() {
  const storeId = await requireMerchantStoreId();
  const [cards, store] = await Promise.all([listGiftCards(storeId), getStore(storeId)]);
  return <GiftCardsAdmin cards={cards} currency={storeCurrency(store?.settings)} />;
}
