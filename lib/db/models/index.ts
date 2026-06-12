/**
 * Model barrel. Raw Mongoose models are exported for the few NON-store-scoped
 * accessors (the `stores` root is keyed by its own `_id`; `users`/`subscriptions`
 * resolve from the session; platform admin reads cross-tenant by design) and for
 * the seed script. Store-scoped reads/writes go through `StoreScopedRepository`
 * instead (see `lib/db/index.ts`).
 */
export {
  UserModel,
  StoreModel,
  ThemeConfigModel,
  SubscriptionModel,
} from "./store";
export { ProductModel, CollectionModel, InventoryAdjustmentModel } from "./catalog";
export { CartModel, OrderModel, CustomerModel, DiscountModel } from "./commerce";
export { EventModel } from "./platform";
export { CounterModel, type CounterDoc } from "./counter";
