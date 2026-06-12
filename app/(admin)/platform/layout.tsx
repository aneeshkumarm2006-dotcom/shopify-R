import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformShell } from "@/components/admin/platform-shell";

/**
 * Platform operator (super-admin) layout. Guards the WHOLE `/platform` subtree to
 * `platform_admin` (defense in depth — each page also guards) and wraps it in the
 * dedicated operator shell instead of the merchant dashboard chrome.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return <PlatformShell>{children}</PlatformShell>;
}
