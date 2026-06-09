/**
 * Serialize a Mongoose lean document into a plain, RSC-safe object that matches
 * the PRD §5 TypeScript shapes exactly.
 *
 * The type layer (types/common.ts) models ids as `string` and dates as ISO
 * `string` so values cross the Server→Client boundary cleanly. Mongo hands back
 * `Date` objects (and, for non-String ids, `ObjectId`). A JSON round-trip is the
 * simplest faithful converter: `Date` → ISO string, `ObjectId` → hex string,
 * `undefined` fields dropped. Every schema sets `versionKey: false`, so there is
 * no `__v` to strip.
 *
 * Returns `null` passthrough so call sites can serialize a possibly-missing doc.
 */
export function serialize<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

export function serializeOrNull<T>(doc: unknown): T | null {
  return doc == null ? null : serialize<T>(doc);
}

export function serializeMany<T>(docs: unknown[]): T[] {
  return docs.map((d) => serialize<T>(d));
}
