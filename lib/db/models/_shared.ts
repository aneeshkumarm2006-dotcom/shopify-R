import mongoose, { type Model, type Schema } from "mongoose";

/**
 * Shared schema conventions (PRD §5 preamble).
 *
 * IDs are stored as `String` so the friendly seed ids ("store_northbound", "p1",
 * "c1", …) survive a round-trip and references stay intact, while the type layer
 * keeps `Id = string`. New documents default to a fresh ObjectId hex string, so
 * records created at runtime (orders, customers in later stages) get Mongo-style
 * ids without any ObjectId↔string mapping at the seam.
 */
export const stringId = {
  type: String,
  default: () => new mongoose.Types.ObjectId().toHexString(),
};

/** Options applied to every top-level collection schema. */
export const baseSchemaOptions = {
  timestamps: true, // createdAt / updatedAt (Date; serialized to ISO strings)
  versionKey: false, // no __v — keeps serialized docs matching PRD §5 shapes
  minimize: false, // keep empty objects (e.g. product.seo: {}) as-is
} as const;

/**
 * Register a model once. Next.js dev hot-reload re-evaluates modules, which would
 * otherwise throw "Cannot overwrite model" — reuse the already-compiled model.
 *
 * Returns `Model<any>` on purpose: feeding our rich domain interfaces (recursive
 * `ThemeConfig`, Mixed-laden `Store`, …) into Mongoose's `Model<T>` generics
 * makes tsc instantiate `FlattenMaps`/`ObtainDocumentType` so deeply it exhausts
 * memory. We keep the persistence layer loosely typed and re-assert the precise
 * PRD §5 shapes at the data-access boundary via `serialize<T>()`, so callers stay
 * fully typed while the compiler stays sane.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defineModel(name: string, schema: Schema): Model<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (mongoose.models[name] as Model<any>) || mongoose.model(name, schema);
}
