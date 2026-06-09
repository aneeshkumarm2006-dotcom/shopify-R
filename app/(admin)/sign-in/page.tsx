import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthConfigured, getMerchantContext } from "@/lib/auth";
import { SignIn } from "@/components/admin/sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  // Already signed in? Skip the sign-in screen — onward to onboarding or the
  // dashboard depending on whether they've claimed a subdomain. (Stub mode keeps
  // the screen visible so the Part A demo flow still works.)
  if (isAuthConfigured()) {
    const ctx = await getMerchantContext();
    if (ctx) redirect(ctx.ready ? "/dashboard" : "/onboarding");
  }
  return <SignIn />;
}
