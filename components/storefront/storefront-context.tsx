"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product, Variant } from "@/types";
import { syncCart } from "@/app/(store)/actions";
import { lineKey } from "./shared";

/**
 * Storefront client state (DESIGN §5) — the single source of truth for the
 * customer session that spans pages: the age-gate verification, the cart, and the
 * cart-sheet open state.
 *
 * The cart is kept in `localStorage` for instant, offline-tolerant UX and MIRRORED
 * to the persisted `carts` collection (Stage 10) on every change via the `syncCart`
 * server action, keyed by an anonymous `sessionId` (cookie + localStorage). The age
 * check lives in a session cookie (Stage 8 enforces the gate server-side). Checkout
 * sends the cart's item references to the server, which re-derives authoritative
 * prices — all behind this same hook, so consuming components don't change.
 */
export interface CartLineState {
  key: string; // `${productId}:${variantId}`
  productId: string;
  variantId: string;
  handle: string;
  title: string;
  variant?: string; // variant title, when the product has options
  price: number; // unit price snapshot
  quantity: number;
  image?: string | null;
}

interface StorefrontValue {
  // --- age gate ---
  verified: boolean;
  ageVerifiedAt: string | null;
  verifyAge: () => void;
  // --- cart ---
  cart: CartLineState[];
  cartCount: number;
  subtotal: number;
  addToCart: (product: Product, variant: Variant, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
  // --- cart sheet ---
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  // --- session ---
  sessionId: string;
  // --- store chrome ---
  currency: string;
  storeName: string;
}

const StorefrontContext = createContext<StorefrontValue | null>(null);

/** Hook for storefront client state. Returns `null` outside a provider (e.g. the
 *  builder preview in Stage 4), so consumers can render a non-interactive variant. */
export function useStorefront(): StorefrontValue | null {
  return useContext(StorefrontContext);
}

const AGE_COOKIE = "offshelf_age_verified";
const SESSION_COOKIE = "offshelf_sid";

function cartStorageKey(storeId: string) {
  return `offshelf_cart_${storeId}`;
}

function readAgeCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${AGE_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function newSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

/**
 * Resolve a stable anonymous session id, persisting it to both `localStorage` (so
 * the same browser keeps one cart) and a cookie (so storefront server actions can
 * read it for cart persistence / order placement). Generated on first visit.
 */
function ensureSessionId(): string {
  if (typeof document === "undefined") return "";
  const cookie = document.cookie
    .match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`))?.[1];
  let id = cookie ? decodeURIComponent(cookie) : null;
  if (!id) {
    try {
      id = localStorage.getItem(SESSION_COOKIE);
    } catch {
      id = null;
    }
  }
  if (!id) id = newSessionId();
  try {
    localStorage.setItem(SESSION_COOKIE, id);
  } catch {
    /* storage blocked — cookie still carries it */
  }
  // 1-year cookie so the session (and its server cart) survives return visits.
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
  return id;
}

export function StorefrontProvider({
  storeId,
  storeName,
  currency = "$",
  ageGateEnabled = true,
  children,
}: {
  storeId: string;
  storeName: string;
  currency?: string;
  ageGateEnabled?: boolean;
  children: ReactNode;
}) {
  // Mounted gate avoids SSR/CSR mismatch: server renders unverified + empty cart,
  // then the client hydrates from cookie/localStorage on mount.
  const [mounted, setMounted] = useState(false);
  const [ageVerifiedAt, setAgeVerifiedAt] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLineState[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    setMounted(true);
    setSessionId(ensureSessionId());
    setAgeVerifiedAt(ageGateEnabled ? readAgeCookie() : new Date().toISOString());
    try {
      const raw = localStorage.getItem(cartStorageKey(storeId));
      if (raw) setCart(JSON.parse(raw) as CartLineState[]);
    } catch {
      /* corrupt/absent storage — start empty */
    }
  }, [storeId, ageGateEnabled]);

  // Persist the cart whenever it changes (after mount, so we don't clobber on load):
  // an instant local copy, mirrored to the server `carts` collection (best-effort).
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(cartStorageKey(storeId), JSON.stringify(cart));
    } catch {
      /* storage full/blocked — non-fatal */
    }
    if (!sessionId) return;
    void syncCart(
      sessionId,
      cart.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
        priceSnapshot: l.price,
      })),
    ).catch(() => {
      /* offline / store unavailable — local cart still holds */
    });
  }, [cart, mounted, storeId, sessionId]);

  const verifyAge = useCallback(() => {
    const now = new Date().toISOString();
    setAgeVerifiedAt(now);
    // Session cookie (no max-age) — per spec, no "remember forever".
    document.cookie = `${AGE_COOKIE}=${encodeURIComponent(now)}; path=/; SameSite=Lax`;
  }, []);

  const addToCart = useCallback(
    (product: Product, variant: Variant, quantity = 1) => {
      const key = lineKey(product._id, variant.id);
      setCart((prev) => {
        const idx = prev.findIndex((l) => l.key === key);
        if (idx >= 0) {
          return prev.map((l, i) =>
            i === idx ? { ...l, quantity: l.quantity + quantity } : l,
          );
        }
        return [
          ...prev,
          {
            key,
            productId: product._id,
            variantId: variant.id,
            handle: product.handle,
            title: product.title,
            variant: product.variants.length > 1 ? variant.title : undefined,
            price: variant.price,
            quantity,
            image: product.images[0] ?? null,
          },
        ];
      });
      setCartOpen(true);
    },
    [],
  );

  const setQuantity = useCallback((key: string, quantity: number) => {
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, quantity) } : l)),
    );
  }, []);

  const removeLine = useCallback((key: string) => {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const value = useMemo<StorefrontValue>(() => {
    const cartCount = cart.reduce((s, l) => s + l.quantity, 0);
    const subtotal = cart.reduce((s, l) => s + l.price * l.quantity, 0);
    return {
      verified: !ageGateEnabled || ageVerifiedAt != null,
      ageVerifiedAt,
      verifyAge,
      cart,
      cartCount,
      subtotal,
      addToCart,
      setQuantity,
      removeLine,
      clearCart,
      cartOpen,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      sessionId,
      currency,
      storeName,
    };
  }, [
    ageGateEnabled,
    ageVerifiedAt,
    verifyAge,
    cart,
    addToCart,
    setQuantity,
    removeLine,
    clearCart,
    cartOpen,
    sessionId,
    currency,
    storeName,
  ]);

  return (
    <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>
  );
}
