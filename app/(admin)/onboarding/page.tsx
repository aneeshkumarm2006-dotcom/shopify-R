import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isStubMode, getMerchantContext } from "@/lib/auth";
import { Onboarding } from "@/components/admin/onboarding";

export const metadata: Metadata = { title: "Set up your store" };

export default async function OnboardingPage() {
  // Onboarding requires a session but NOT a claimed subdomain (that's the whole
  // point of this screen). Bounce anonymous users to sign-in and already-claimed
  // merchants to the dashboard. Stub mode renders the screen unconditionally.
  if (!isStubMode()) {
    const ctx = await getMerchantContext();
    if (!ctx) redirect("/sign-in");
    if (ctx.ready) redirect("/dashboard");
  }
  return <Onboarding />;
}
