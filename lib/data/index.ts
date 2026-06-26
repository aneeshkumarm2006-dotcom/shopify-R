/**
 * Tenant-scoped data-access layer — the contract every stage imports.
 *
 * RULES (enforced from Stage 0, fulfilled by Part B):
 *  - Every store-scoped function takes `storeId` as its FIRST argument.
 *  - Functions are `async` and return typed PRD §5 shapes (never raw mocks).
 *  - Screens import ONLY from here, never from `lib/data/mocks/*`.
 *
 * Stage 6 wired these bodies to MongoDB behind the SAME signatures: when
 * `MONGODB_URI` is set, every store-scoped query runs through the centralized
 * `StoreScopedRepository` (storeId enforced — PRD §9); when it is unset, the
 * seams fall back to the Part-A mock fixtures so screens still render with no DB.
 *
 * Server-only: this barrel reaches Mongoose. Client Components must not import it
 * (the onboarding form uses `lib/data/subdomain.ts`, which is DB-free).
 */
export * from "./store";
export * from "./account";
export * from "./staff";
export * from "./products";
export * from "./csv";
export * from "./discounts";
export * from "./collections";
export * from "./collection-rules";
export * from "./reviews";
export * from "./gift-cards";
export * from "./segments";
export * from "./campaigns";
export * from "./abandoned";
export * from "./inventory";
export * from "./locations";
export * from "./orders";
export * from "./customers";
export * from "./theme";
export * from "./analytics";
export * from "./analytics-insights";
export * from "./cart";
export * from "./tax";
export * from "./shipping";
export * from "./checkout";
export * from "./platform";
export * from "./health";
export * from "./events";
export * from "./errors";
export * from "./ops";
export * from "./notes";
export * from "./email-log";
export * from "./system";
export * from "./traffic";
export * from "./sequence";
