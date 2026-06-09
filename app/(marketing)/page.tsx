import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import {
  Hero,
  Problem,
  Features,
  Verticals,
  HowItWorks,
  Pricing,
  Trust,
  Faq,
  FinalCta,
} from "@/components/marketing/sections";

/**
 * Offshelf marketing landing page (Stage 5) — served on the apex domain.
 *
 * Designed from PRD §1 positioning (the PRD does not specify this page). Reuses the
 * app's design tokens via the semantic Tailwind layer: warm-monochrome canvas, lime
 * accent reserved for CTAs, Clash Display (`font-display`) headlines. CTAs route into
 * the (admin) sign-in flow.
 *
 * IA / section order: hero → problem → features → verticals → how-it-works →
 * pricing → trust & compliance → FAQ → final CTA, wrapped by marketing header/footer.
 *
 * ⚠ All copy and imagery are PLACEHOLDER — final messaging, brand confirmation,
 * pricing, and assets are pending user input (see TODO "Needs user input").
 */
export default function MarketingHome() {
  return (
    <div className="min-h-screen bg-bg">
      <MarketingHeader />
      <main>
        <Hero />
        <Problem />
        <Features />
        <Verticals />
        <HowItWorks />
        <Pricing />
        <Trust />
        <Faq />
        <FinalCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
