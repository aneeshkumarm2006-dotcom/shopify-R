import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isStubMode, getMerchantContext } from "@/lib/auth";
import { getStore, suggestAvailableSubdomain } from "@/lib/data";
import { Onboarding } from "@/components/admin/onboarding";

export const metadata: Metadata = { title: "Set up your store" };

export default async function OnboardingPage() {
  // Onboarding requires a session but NOT a claimed subdomain (that's the whole
  // point of this screen). Bounce anonymous users to sign-in and already-claimed
  // merchants to the dashboard. Stub mode renders the screen unconditionally.
  let suggested = "";
  if (!isStubMode()) {
    const ctx = await getMerchantContext();
    if (!ctx) redirect("/sign-in");
    if (ctx.ready) redirect("/dashboard");
    // Prefill a ready-to-go, pre-validated subdomain from the store's default name
    // (e.g. "Prem's store" → "prem"), so claiming is one click, not a decision.
    const store = await getStore(ctx.storeId);
    const seed = (store?.name ?? "").replace(/['’]s store$/i, "");
    suggested = await suggestAvailableSubdomain(seed);
  }
  return <Onboarding suggested={suggested} />;
}
