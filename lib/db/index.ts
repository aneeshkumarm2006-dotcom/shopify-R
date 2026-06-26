/**
 * Server-only data layer barrel (Stage 6). NEVER import this from a Client
 * Component — it pulls in Mongoose, which has no browser build. Client code that
 * needs a tenant-safe helper (e.g. subdomain validation) imports from
 * `lib/data/subdomain.ts` instead.
 *
 * Store-scoped collections are exposed as ready-made `StoreScopedRepository`
 * instances so the data-access seams (`lib/data/*`) never touch a raw, unscoped
 * model — `storeId` is enforced for every query in one place (PRD §9).
 */
import { StoreScopedRepository } from "./repo";
import {
  CartModel,
  CollectionModel,
  CustomerModel,
  DiscountModel,
  GiftCardModel,
  CampaignModel,
  InventoryAdjustmentModel,
  InventoryLevelModel,
  LocationModel,
  OrderModel,
  ProductModel,
  ReviewModel,
} from "./models";
import type {
  Cart,
  Collection,
  Customer,
  Discount,
  GiftCard,
  Campaign,
  InventoryAdjustment,
  InventoryLevel,
  Location,
  Order,
  Product,
  Review,
} from "@/types";

export { dbConnect, isDbConfigured } from "./connect";
export { serialize, serializeOrNull, serializeMany } from "./serialize";
export { requireStoreId, scopedFilter, TenantScopeError } from "./scope";
export { nextOrderNumber, setOrderCounterFloor } from "./counter";
export { StoreScopedRepository } from "./repo";

// Raw models for non-store-scoped accessors + the seed script.
export * from "./models";

/* ---- Tenant-scoped repositories (the only way to touch store data) ---- */
export const Products = new StoreScopedRepository<Product>(ProductModel);
export const Collections = new StoreScopedRepository<Collection>(CollectionModel);
export const InventoryAdjustments = new StoreScopedRepository<InventoryAdjustment>(
  InventoryAdjustmentModel,
);
export const Orders = new StoreScopedRepository<Order>(OrderModel);
export const Customers = new StoreScopedRepository<Customer>(CustomerModel);
export const Carts = new StoreScopedRepository<Cart>(CartModel);
export const Discounts = new StoreScopedRepository<Discount>(DiscountModel);
export const Reviews = new StoreScopedRepository<Review>(ReviewModel);
export const GiftCards = new StoreScopedRepository<GiftCard>(GiftCardModel);
export const Campaigns = new StoreScopedRepository<Campaign>(CampaignModel);
export const Locations = new StoreScopedRepository<Location>(LocationModel);
export const InventoryLevels = new StoreScopedRepository<InventoryLevel>(InventoryLevelModel);
