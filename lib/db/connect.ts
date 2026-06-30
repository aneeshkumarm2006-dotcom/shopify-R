import mongoose from "mongoose";

/**
 * Pooled MongoDB connection for serverless (Stage 6).
 *
 * Next.js on Vercel reuses warm lambdas, so we cache the connection (and the
 * in-flight connect promise) on `globalThis` to survive hot-reloads in dev and
 * avoid opening a new pool per invocation in prod. This is the standard Mongoose
 * + serverless pattern.
 *
 * `isDbConfigured()` lets the data-access layer fall back to the Part-A mock
 * fixtures when `MONGODB_URI` is unset, so screens keep rendering with zero
 * infrastructure. Once the env var is set (and the store is seeded), the exact
 * same seams hit real MongoDB — no call site changes (PRD §5, TODO Stage 6).
 */

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "offshelf";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Reuse a single cache across hot-reloads / warm lambdas.
const globalForMongoose = globalThis as typeof globalThis & {
  _offshelfMongoose?: MongooseCache;
};

const cache: MongooseCache = (globalForMongoose._offshelfMongoose ??= {
  conn: null,
  promise: null,
});

/** True when a MongoDB URI is configured; gates the real-vs-mock data path. */
export function isDbConfigured(): boolean {
  return Boolean(MONGODB_URI);
}

/**
 * Connect (once) and return the shared Mongoose instance. Throws if called
 * without `MONGODB_URI` — callers gate on `isDbConfigured()` first.
 */
export async function dbConnect(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Configure it in .env.local, or rely on the mock data fallback (isDbConfigured() === false).",
    );
  }
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    // `bufferCommands: false` surfaces connection problems immediately instead of
    // silently queuing queries against a dead pool.
    cache.promise = mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      bufferCommands: false,
      // The storefront data cache (lib/cache) now absorbs most read volume, so a
      // warm lambda needs far fewer concurrent connections. Lower the ceiling and
      // let idle lambdas drop to zero open sockets (minPoolSize: 0).
      maxPoolSize: 5,
      minPoolSize: 0,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null; // allow a retry on the next call
    throw err;
  }
  return cache.conn;
}
