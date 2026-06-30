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
  ThemeVersionModel,
  StoreMemberModel,
  CustomDomainModel,
  LocationModel,
  SubscriptionModel,
} from "./store";
export {
  ProductModel,
  CollectionModel,
  ReviewModel,
  InventoryAdjustmentModel,
  InventoryLevelModel,
} from "./catalog";
export {
  CartModel,
  OrderModel,
  CustomerModel,
  DiscountModel,
  GiftCardModel,
  CampaignModel,
} from "./commerce";
export {
  EventModel,
  ErrorModel,
  StoreNoteModel,
  EmailLogModel,
  PageViewModel,
} from "./platform";
export { CounterModel, type CounterDoc } from "./counter";
export { RateLimitModel } from "./rate-limit";
