import { Schema } from "mongoose";
import { defineModel } from "./_shared";

/**
 * Atomic sequence counters (PRD §11 Q4 — per-store sequential order numbers).
 *
 * One document per sequence, keyed by a string like `order:<storeId>`. A single
 * `findOneAndUpdate({ _id }, { $inc: { seq: 1 } }, { upsert: true, new: true })`
 * is atomic in MongoDB, so concurrent inserts for the same store get distinct,
 * gap-free numbers, and different stores never collide (different `_id`).
 */
export interface CounterDoc {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema(
  {
    _id: { type: String, required: true }, // e.g. "order:store_northbound"
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const CounterModel = defineModel("Counter", CounterSchema);
