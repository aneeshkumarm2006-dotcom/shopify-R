/**
 * Transactional email (Stage 13, PRD §11 — order-confirmation default = include).
 *
 * One env-gated integration point so a confirmation email goes out on order
 * creation, with the same graceful-degradation contract as the other external
 * services (DB / Cloudinary / payments): unset `RESEND_API_KEY` → no-op, so the
 * app runs end-to-end with zero infrastructure.
 *
 *  - **client**        — `isEmailConfigured()` + the low-level Resend `sendEmail`
 *    transport (REST via `fetch`, no SDK).
 *  - **templates**     — pure `renderOrderConfirmationEmail()` (HTML + text).
 *  - **notifications** — `sendOrderConfirmation()`, the failure-tolerant entry
 *    point `placeOrder` calls (never throws).
 *
 * Server-only: `client.ts` reads `RESEND_API_KEY` and hits the network; do not
 * import this from a Client Component.
 */
export * from "./client";
export * from "./templates";
export * from "./marketing-templates";
export * from "./notifications";
