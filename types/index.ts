/**
 * Offshelf type layer — mirrors the PRD §5 data model field-for-field.
 * The 10 collections:
 *   5.1  User                 (store.ts)
 *   5.2  Store                (store.ts)
 *   5.3  ThemeConfig          (store.ts)  + Section / Block / Template
 *   5.4  Product              (catalog.ts) + Variant / ProductOption
 *   5.5  Collection           (catalog.ts)
 *   5.6  InventoryAdjustment  (catalog.ts)
 *   5.7  Cart                 (commerce.ts)
 *   5.8  Order                (commerce.ts) + OrderLineItem
 *   5.9  Customer             (commerce.ts)
 *   5.10 Subscription         (store.ts)
 */
export * from "./common";
export * from "./store";
export * from "./catalog";
export * from "./commerce";
export * from "./views";
export * from "./platform";
