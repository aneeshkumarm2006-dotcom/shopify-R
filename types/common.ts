/**
 * Shared primitives for the data model (PRD §5).
 *
 * `Id` is a string stand-in for a Mongo `ObjectId` — the stub data layer (Part A)
 * uses string ids; Stage 6 swaps in real ObjectIds behind the same field names.
 * Dates are typed as `string` (ISO) for serializability across the RSC boundary;
 * the DB layer maps these to/from `Date` at the seam.
 */
export type Id = string;
export type ISODate = string;

/** Every collection carries these (PRD §5 preamble). */
export interface Timestamps {
  createdAt: ISODate;
  updatedAt: ISODate;
}
