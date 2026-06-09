/**
 * Payment & billing seams (Stage 12, PRD §2.3 / §6.11).
 *
 * Two stubbed-but-typed integration points so a high-risk processor wires in later
 * with no re-architecture (the MVP processes nothing and collects no card data):
 *
 *  - **storefront** — customer → merchant: `createPaymentIntent` (checkout) +
 *    `handlePaymentWebhook` (the `/api/payments/webhook` route stub).
 *  - **billing**    — merchant → Offshelf: the `free`/`standard` plan catalog +
 *    `getBillingPortalSession` (manual provisioning until a processor is live).
 *
 * Server-only: `storefront.ts` reaches the orders data layer (Mongoose). Client
 * Components that only need the plan catalog should import `./billing` directly.
 */
export * from "./types";
export * from "./storefront";
export * from "./billing";
