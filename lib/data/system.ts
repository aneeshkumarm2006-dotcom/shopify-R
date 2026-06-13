import mongoose from "mongoose";
import type { SystemHealth } from "@/types";
import { isDbConfigured, dbConnect } from "@/lib/db";
import { getMisalignedStores, type MisalignedStore } from "./platform";

/**
 * Platform system health + compliance (operator P3). System health is a live
 * config + connectivity snapshot of the platform's own services; compliance is the
 * subset of store health checks that are policy/legal-relevant for the verticals
 * (age gate, injected scripts). Operator-only (gated by `requirePlatformAdmin`).
 */

export async function getSystemHealth(): Promise<SystemHealth> {
  const env = process.env;

  // DB: configured + a live ping with latency.
  let dbConnected = false;
  let latencyMs: number | null = null;
  if (isDbConfigured()) {
    try {
      const t0 = Date.now();
      await dbConnect();
      await mongoose.connection.db?.admin().ping();
      dbConnected = true;
      latencyMs = Date.now() - t0;
    } catch {
      dbConnected = false;
    }
  }

  return {
    db: { configured: isDbConfigured(), connected: dbConnected, latencyMs },
    email: { configured: Boolean(env.RESEND_API_KEY) },
    payments: { configured: Boolean(env.PAYMENTS_PROVIDER) },
    billing: { configured: Boolean(env.BILLING_PROVIDER) },
    auth: {
      configured: Boolean(
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.NEXTAUTH_SECRET,
      ),
    },
  };
}

/** Policy/legal-relevant health checks (age gate off, injected scripts). */
const COMPLIANCE_RULES = new Set(["agegate_off_restricted", "code_injection_has_script"]);

/** Stores failing a COMPLIANCE check — the moderation queue. */
export async function getComplianceFlags(): Promise<MisalignedStore[]> {
  const misaligned = await getMisalignedStores();
  return misaligned
    .map((s) => ({ ...s, failing: s.failing.filter((f) => COMPLIANCE_RULES.has(f.id)) }))
    .filter((s) => s.failing.length > 0);
}
