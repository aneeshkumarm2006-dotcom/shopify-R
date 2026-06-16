import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { HeroPeek } from "@/components/marketing/hero-peek";

/**
 * Offshelf marketing landing sections (Stage 5). Token-driven, fully responsive,
 * built on the same semantic Tailwind layer as the app. Warm-monochrome canvas,
 * lime accent reserved for CTAs, Clash Display (`font-display`) for headlines.
 *
 * NOTE: all copy below is PLACEHOLDER — final messaging, brand confirmation,
 * pricing, and imagery are pending user input (see TODO "Needs user input").
 */

/* ---------- shared bits ---------- */

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface-subtle px-3 py-1 text-xs font-medium uppercase tracking-wide text-text-muted">
      {children}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  lead,
  center,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-[52ch] text-center" : "max-w-[52ch]"}>
      {eyebrow && (
        <div className={center ? "flex justify-center" : ""}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
      )}
      <h2 className="mt-5 font-display text-3xl leading-[1.1] text-text-strong sm:text-[2.5rem]">
        {title}
      </h2>
      {lead && <p className="mt-4 text-md leading-relaxed text-text-muted">{lead}</p>}
    </div>
  );
}

/* ---------- 1 · Hero ---------- */

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* soft lime glow behind the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-72 max-w-[720px] rounded-full bg-accent-tint blur-3xl opacity-60"
      />
      <div className="relative mx-auto max-w-[1120px] px-6 pb-20 pt-20 sm:pt-28">
        <div className="mx-auto flex max-w-[64ch] flex-col items-center text-center">
          <Eyebrow>
            <Icon name="sparkle" size={14} aria-hidden /> Commerce for restricted goods
          </Eyebrow>
          <h1 className="mt-6 font-display text-4xl leading-[1.04] text-text-strong sm:text-[4.25rem]">
            The store platform for businesses everyone else bans.
          </h1>
          <p className="mt-6 max-w-[56ch] text-md leading-relaxed text-text-muted sm:text-lg">
            Vape, cannabis, and CBD merchants get shut out by mainstream platforms.
            Offshelf is built for them — a Shopify-style store builder, real inventory and
            orders, a 21+ age gate, and a payment layer designed for high-risk verticals.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-in?mode=signup"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-6 text-base font-medium text-text-on-accent transition-colors duration-fast hover:bg-accent-hover"
            >
              Get started free <Icon name="arrowRight" size={16} aria-hidden />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-6 text-base text-text transition-colors duration-fast hover:bg-surface-subtle"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-4 text-xs text-text-muted">
            No DevOps. Live on your subdomain in minutes. Cancel anytime.
          </p>
        </div>

        {/* Interactive browser-frame product peek */}
        <HeroPeek />
      </div>
    </section>
  );
}

/* ---------- 2 · Problem / why ---------- */

export function Problem() {
  const points: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "lock",
      title: "Mainstream platforms ban you",
      body: "Shopify, Squarespace, and their payment partners refuse vape, cannabis, and CBD outright — usually after you've already built.",
    },
    {
      icon: "alertTri",
      title: "Generic builders aren't compliant",
      body: "No age gate, no 21+ enforcement, no audit trail. You're left bolting on compliance the platform was never designed for.",
    },
    {
      icon: "x",
      title: "Processors freeze high-risk funds",
      body: "Stripe and PayPal flag restricted categories and hold or close accounts, taking your storefront down with them.",
    },
  ];
  return (
    <section className="border-y border-border bg-surface-subtle">
      <div className="mx-auto max-w-[1120px] px-6 py-20">
        <SectionHeading
          center
          eyebrow="The problem"
          title="Everyone else treats your category as a liability."
          lead="The store tech is commodity. The reason you can't use it is policy — not capability. Offshelf exists to close that gap."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {points.map((p) => (
            <div key={p.title} className="rounded-lg border border-border bg-surface p-6">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-accent-tint text-text-strong">
                <Icon name={p.icon} size={20} aria-hidden />
              </span>
              <h3 className="mt-4 text-md font-semibold text-text-strong">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 3 · Features overview ---------- */

export function Features() {
  const features: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "layout",
      title: "Section/block store builder",
      body: "Drag-and-drop sections, live preview, and a closed set of mobile-safe blocks. Build a credible storefront without touching code.",
    },
    {
      icon: "products",
      title: "Products & variants",
      body: "Rich descriptions, images, options and variants with SKUs, prices, and compare-at — plus per-product SEO overrides.",
    },
    {
      icon: "inventory",
      title: "First-class inventory",
      body: "Per-variant stock, low-stock thresholds and alerts, automatic decrement on orders, and a full adjustment audit log.",
    },
    {
      icon: "orders",
      title: "Orders & customers",
      body: "Sequential order numbers, line-item snapshots, fulfillment and payment status, and per-store customer records.",
    },
    {
      icon: "lock",
      title: "21+ age gate built in",
      body: "A configurable compliance interstitial gates every storefront and stamps the verification timestamp onto each order.",
    },
    {
      icon: "analytics",
      title: "Sales at a glance",
      body: "A dashboard with total sales, order counts, recent activity, and low-stock alerts — the numbers that actually matter.",
    },
  ];
  return (
    <section id="features" className="scroll-mt-20">
      <div className="mx-auto max-w-[1120px] px-6 py-20">
        <SectionHeading
          eyebrow="Everything you need"
          title="A complete commerce platform — minus the part that gets you banned."
          lead="Builder, products, inventory, and orders are table stakes. We ship all of them, then add the compliance and payment layer the big platforms refuse to."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-lg border border-border bg-surface p-6 transition-colors duration-base hover:border-border-strong"
            >
              <span className="grid h-10 w-10 place-items-center rounded-md bg-accent-tint text-text-strong">
                <Icon name={f.icon} size={20} aria-hidden />
              </span>
              <h3 className="mt-4 text-md font-semibold text-text-strong">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 4 · Verticals served ---------- */

export function Verticals() {
  const verticals: { icon: IconName; name: string; note: string }[] = [
    { icon: "sparkle", name: "Vape & e-liquid", note: "Devices, pods, and e-liquid with strength variants." },
    { icon: "leaf", name: "Cannabis & hemp", note: "Flower, pre-rolls, and accessories where permitted." },
    { icon: "tag", name: "CBD & wellness", note: "Tinctures, edibles, and topicals with lab details." },
    { icon: "box", name: "Other restricted goods", note: "Categories mainstream platforms decline to serve." },
  ];
  return (
    <section id="verticals" className="scroll-mt-20 border-y border-border bg-surface-subtle">
      <div className="mx-auto max-w-[1120px] px-6 py-20">
        <SectionHeading
          center
          eyebrow="Built for your category"
          title="Made for the verticals that get turned away."
          lead="If a payment partner or platform policy has shut you down before, you're exactly who Offshelf is for."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {verticals.map((v) => (
            <div key={v.name} className="rounded-lg border border-border bg-surface p-6">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-accent text-text-on-accent">
                <Icon name={v.icon} size={22} aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold text-text-strong">{v.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{v.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-text-muted">
          You are responsible for selling within your local laws. Offshelf provides the
          compliance tooling; licensing and legality remain yours.
        </p>
      </div>
    </section>
  );
}

/* ---------- 5 · How it works ---------- */

export function HowItWorks() {
  const steps: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "user",
      title: "Sign in with Google",
      body: "Create your account in seconds. We provision an empty draft store and your plan automatically.",
    },
    {
      icon: "store",
      title: "Claim your subdomain",
      body: "Pick yourstore.offshelf.app — validated for uniqueness and DNS safety as you type.",
    },
    {
      icon: "layout",
      title: "Build & add products",
      body: "Compose your storefront in the section editor and add products, variants, and inventory.",
    },
    {
      icon: "check",
      title: "Publish in minutes",
      body: "Flip from draft to live and your subdomain starts serving — no build step, no deploy.",
    },
  ];
  return (
    <section id="how-it-works" className="scroll-mt-20">
      <div className="mx-auto max-w-[1120px] px-6 py-20">
        <SectionHeading
          center
          eyebrow="How it works"
          title="From sign-up to a live store in minutes."
          lead="Publishing isn't a deploy — it's a status flip. The same renderer that powers the preview serves your live storefront."
        />
        <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-lg border border-border bg-surface p-6">
              <span className="mono absolute right-5 top-5 text-2xl text-border-strong">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-md bg-accent-tint text-text-strong">
                <Icon name={s.icon} size={20} aria-hidden />
              </span>
              <h3 className="mt-4 text-md font-semibold text-text-strong">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- 6 · Pricing teaser ---------- */

export function Pricing() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      cadence: "/mo",
      tagline: "Everything you need to launch your first store.",
      features: [
        "One store on a subdomain",
        "Section/block store builder",
        "Products, variants & inventory",
        "21+ age gate & order management",
      ],
      cta: "Start free",
      highlighted: false,
    },
    {
      name: "Standard",
      price: "$—",
      cadence: "/mo",
      tagline: "For growing stores that need more headroom.",
      features: [
        "Everything in Free",
        "Higher product & order limits",
        "Priority compliance support",
        "Payment-processor onboarding seam",
      ],
      cta: "Get started",
      highlighted: true,
    },
  ];
  return (
    <section id="pricing" className="scroll-mt-20 border-y border-border bg-surface-subtle">
      <div className="mx-auto max-w-[1120px] px-6 py-20">
        <SectionHeading
          center
          eyebrow="Pricing"
          title="Simple plans. No surprises."
          lead="Start free and upgrade when you grow. Final pricing for Standard is being confirmed."
        />
        <div className="mx-auto mt-12 grid max-w-[760px] gap-6 md:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl border bg-surface p-7 ${
                plan.highlighted ? "border-accent shadow-md" : "border-border"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 right-6 rounded-pill bg-accent px-3 py-1 text-xs font-medium text-text-on-accent">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-text-strong">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-4xl text-text-strong">{plan.price}</span>
                <span className="text-sm text-text-muted">{plan.cadence}</span>
              </div>
              <p className="mt-2 text-sm text-text-muted">{plan.tagline}</p>
              <ul className="mt-6 flex flex-col gap-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-text">
                    <Icon name="check" size={16} className="mt-0.5 text-success" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-in?mode=signup"
                className={`mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-5 text-base font-medium transition-colors duration-fast ${
                  plan.highlighted
                    ? "bg-accent text-text-on-accent hover:bg-accent-hover"
                    : "border border-border text-text hover:bg-surface-subtle"
                }`}
              >
                {plan.cta} <Icon name="arrowRight" size={16} aria-hidden />
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-text-muted">
          Plans are provisioned manually during MVP. Live billing arrives with the
          high-risk payment integration.
        </p>
      </div>
    </section>
  );
}

/* ---------- 7 · Trust & compliance ---------- */

export function Trust() {
  const items: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "lock",
      title: "21+ age verification",
      body: "A flat 21+ gate blocks every storefront until passed, and the verification timestamp is stamped on each order — treated as compliance, not decoration.",
    },
    {
      icon: "layers",
      title: "Strict tenant isolation",
      body: "Every store's data is scoped by store at the data layer, so one merchant's orders and customers can never leak into another's.",
    },
    {
      icon: "tag",
      title: "Payment seams, ready",
      body: "Orders complete in a pending state behind a clean integration seam, so a high-risk processor can be wired in later without re-architecting.",
    },
    {
      icon: "code",
      title: "SEO & code control",
      body: "Per-page SEO, custom head/body injection, and auto-generated sitemap and robots — with platform-shell injection sanitized.",
    },
  ];
  return (
    <section id="trust" className="scroll-mt-20">
      <div className="mx-auto max-w-[1120px] px-6 py-20">
        <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHeading
            eyebrow="Trust & compliance"
            title="Compliance isn't a checkbox here — it's the foundation."
            lead="The reason mainstream platforms won't serve you is the exact reason we built Offshelf around compliance and high-risk payments from day one."
          />
          <div className="grid gap-5 sm:grid-cols-2">
            {items.map((it) => (
              <div key={it.title} className="rounded-lg border border-border bg-surface p-6">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-accent-tint text-text-strong">
                  <Icon name={it.icon} size={20} aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold text-text-strong">{it.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{it.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 8 · FAQ ---------- */

export function Faq() {
  const faqs: { q: string; a: string }[] = [
    {
      q: "Why can't I just use Shopify or Squarespace?",
      a: "Their policies and payment partners ban vape, cannabis, and CBD merchants — often after you've already built your store. Offshelf is purpose-built to serve these verticals.",
    },
    {
      q: "Is payment processing live yet?",
      a: "Not in the current release. Orders are created in a pending state behind a clean payment seam, so a high-risk processor can be connected later without rebuilding your store.",
    },
    {
      q: "How does the age gate work?",
      a: "A configurable 21+ interstitial blocks your storefront until the visitor confirms their age. The verification timestamp is recorded and stamped onto every resulting order.",
    },
    {
      q: "Do I get my own domain?",
      a: "Every store publishes to its own subdomain — yourstore.offshelf.app. Custom domains are on the roadmap but out of scope for now.",
    },
    {
      q: "Can I move my store live without a developer?",
      a: "Yes. There's no build or deploy step — publishing flips your store from draft to live and your subdomain starts serving immediately.",
    },
    {
      q: "Is Offshelf responsible for my legal compliance?",
      a: "We provide the compliance tooling — age gating, audit trails, and isolation. Licensing and selling within your local laws remain your responsibility.",
    },
  ];
  return (
    <section id="faq" className="scroll-mt-20 border-t border-border bg-surface-subtle">
      <div className="mx-auto max-w-[760px] px-6 py-20">
        <SectionHeading center eyebrow="FAQ" title="Questions, answered." />
        <div className="mt-10 flex flex-col gap-3">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-lg border border-border bg-surface px-5 open:shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-medium text-text-strong [&::-webkit-details-marker]:hidden">
                {item.q}
                <Icon
                  name="chevronDown"
                  size={18}
                  className="shrink-0 text-text-muted transition-transform duration-base group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="pb-5 pr-8 text-sm leading-relaxed text-text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 9 · Final CTA ---------- */

export function FinalCta() {
  return (
    <section className="scroll-mt-20">
      <div className="mx-auto max-w-[1120px] px-6 py-20">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-text-strong px-8 py-16 text-center sm:px-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent opacity-20 blur-3xl"
          />
          <div className="relative mx-auto max-w-[44ch]">
            <h2 className="font-display text-3xl leading-tight text-bg sm:text-4xl">
              Build the store the others wouldn&apos;t let you.
            </h2>
            <p className="mt-4 text-md text-bg">
              Get a compliant storefront live on your subdomain in minutes. Free to start —
              no DevOps, no credit card.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/sign-in?mode=signup"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-6 text-base font-medium text-text-on-accent transition-colors duration-fast hover:bg-accent-hover"
              >
                Get started free <Icon name="arrowRight" size={16} aria-hidden />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex h-11 items-center rounded-md border border-bg/30 px-6 text-base text-bg transition-colors duration-fast hover:bg-bg/10"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
