/**
 * Part A checkout → confirmation handoff. With no order persistence yet (Stage 10
 * creates the real `order` + customer + inventory decrement), "Place order" stashes a
 * lightweight summary in `sessionStorage` so the confirmation page can echo it. This
 * whole module is replaced by a real order read in Stage 10.
 */
export interface PlacedOrder {
  orderNumber: number;
  email: string;
  total: number;
  currency: string;
  items: { title: string; variant?: string; quantity: number; price: number }[];
  /** Applied promo code + the amount it shaved off (display echo only). */
  discount?: { code: string; amount: number };
  /** How the customer chose to settle, for the confirmation echo. */
  settlementMethod?: "online" | "cod" | "in_store";
}

const KEY = "offshelf_last_order";

export function stashOrder(order: PlacedOrder) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    /* storage blocked — confirmation falls back to a generic message */
  }
}

export function readOrder(): PlacedOrder | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PlacedOrder) : null;
  } catch {
    return null;
  }
}
