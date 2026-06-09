/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Model, QueryOptions } from "mongoose";
import { dbConnect } from "./connect";
import { scopedFilter } from "./scope";
import { serialize, serializeMany, serializeOrNull } from "./serialize";

/**
 * A query filter for the scoped repository. Kept as a loose record because the
 * type layer models dates/ids as `string` while stored documents use
 * `Date`/`ObjectId`, so range queries like `{ createdAt: { $gte: someDate } }`
 * would otherwise fight the string field type. `storeId` is always injected by
 * `scopedFilter`, never trusted from here.
 */
export type ScopedFilter = Record<string, unknown>;

/**
 * Store-scoped repository (PRD §9 — centralize isolation "so it can't be
 * bypassed", TODO Stage 6).
 *
 * Every store-scoped collection is accessed *only* through one of these. There is
 * no method that omits `storeId`: each runs its filter through `scopedFilter`,
 * which forces the tenant scope and throws on a missing/empty `storeId`. Callers
 * physically cannot read or write across stores through this layer — the model is
 * private (`#model`), so there is no escape hatch to the raw, unscoped model.
 *
 * The generic `T` is the precise PRD §5 return shape; the underlying Mongoose
 * model stays loosely typed (`Model<any>`) for compiler performance, and results
 * are re-typed at the `serialize<T>()` boundary.
 */
export class StoreScopedRepository<T> {
  readonly #model: Model<any>;

  constructor(model: Model<any>) {
    this.#model = model;
  }

  async findMany(
    storeId: string,
    filter: ScopedFilter = {},
    options: QueryOptions = {},
  ): Promise<T[]> {
    await dbConnect();
    const rows = await this.#model.find(scopedFilter(storeId, filter), null, options).lean();
    return serializeMany<T>(rows);
  }

  async findOne(storeId: string, filter: ScopedFilter = {}): Promise<T | null> {
    await dbConnect();
    const row = await this.#model.findOne(scopedFilter(storeId, filter)).lean();
    return serializeOrNull<T>(row);
  }

  /** Find by `_id`, still scoped — a foreign id from another store returns null. */
  async findById(storeId: string, id: string): Promise<T | null> {
    return this.findOne(storeId, { _id: id });
  }

  async count(storeId: string, filter: ScopedFilter = {}): Promise<number> {
    await dbConnect();
    return this.#model.countDocuments(scopedFilter(storeId, filter));
  }

  /** Insert a document with `storeId` forced to the scope. */
  async create(storeId: string, data: ScopedFilter): Promise<T> {
    await dbConnect();
    const [doc] = await this.#model.create([scopedFilter(storeId, data)]);
    return serialize<T>(doc.toObject());
  }

  async updateOne(
    storeId: string,
    filter: ScopedFilter,
    update: Record<string, unknown>,
  ): Promise<T | null> {
    await dbConnect();
    const row = await this.#model
      .findOneAndUpdate(scopedFilter(storeId, filter), update, { new: true })
      .lean();
    return serializeOrNull<T>(row);
  }

  /**
   * Update the matching document, or create it if none exists — still scoped.
   * The scoped filter's equality conditions (incl. the forced `storeId`) seed the
   * inserted document, and schema defaults (`_id`, enums) apply on insert. Used by
   * the session cart, which is one active doc per `(storeId, sessionId)`.
   */
  async upsertOne(
    storeId: string,
    filter: ScopedFilter,
    update: Record<string, unknown>,
  ): Promise<T> {
    await dbConnect();
    const row = await this.#model
      .findOneAndUpdate(scopedFilter(storeId, filter), update, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      })
      .lean();
    return serialize<T>(row);
  }

  async deleteOne(storeId: string, filter: ScopedFilter): Promise<boolean> {
    await dbConnect();
    const res = await this.#model.deleteOne(scopedFilter(storeId, filter));
    return res.deletedCount > 0;
  }
}
