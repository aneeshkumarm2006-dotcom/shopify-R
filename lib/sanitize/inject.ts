import type { CodeInjection } from "@/types";

/**
 * Code-injection sanitizer (Stage 11 / PRD §9).
 *
 * ── Threat model & self-XSS scope (documented per PRD §9) ──────────────────────
 * Code injection is a first-class merchant feature: the head/body HTML fields exist
 * so a store owner can add analytics, pixels, and chat widgets — which legitimately
 * means `<script>`. We therefore do NOT strip scripts. The risk that buys is
 * **self-XSS**: a merchant can run arbitrary JavaScript on *their own* storefront
 * and against *their own* customers.
 *
 * That risk is bounded by architecture, not by this sanitizer:
 *   • Injected code is rendered ONLY by the `(store)` storefront route group. The
 *     platform admin (`(admin)`) and marketing (`(marketing)`) groups never emit it.
 *   • In production each storefront serves on its own `*.offshelf.app` subdomain — a
 *     separate origin from the admin app and from every other tenant. Same-origin
 *     policy means injected JS cannot read the admin session cookie, reach the
 *     dashboard, or touch another store. The blast radius is one store's own visitors.
 *
 * What this module DOES enforce — the cases that could escape that storefront box and
 * affect the platform shell or corrupt the document:
 *   • `<base>` is removed — it rewrites every relative URL on the page (including
 *     links back into the app shell) and is a navigation-hijack primitive.
 *   • CSS/JS that breaks out of its wrapping tag (`</style>`, `</script>`) is
 *     neutralized so a value injected into one channel can't smuggle markup into the
 *     document at large.
 *   • Each field is length-capped to keep a runaway paste from bloating every page.
 *
 * The Settings UI already tells merchants "Code that could affect the Offshelf shell
 * is sanitized" — this is the implementation behind that promise.
 */

/** Generous caps — enough for real analytics/widget snippets, not for abuse. */
const MAX_HTML = 20_000;
const MAX_CSS = 20_000;
const MAX_JS = 20_000;

const BASE_TAG = /<base\b[^>]*>/gi;
const STYLE_BREAKOUT = /<\s*\/?\s*style\b/gi;
const SCRIPT_TAG_IN_CSS = /<\s*\/?\s*script\b/gi;
const SCRIPT_CLOSE = /<\s*\/\s*script/gi;

/**
 * Sanitize a head/body HTML fragment. Scripts are intentionally allowed (analytics
 * etc.); only platform-affecting constructs are removed (see module note).
 */
export function sanitizeInjectedHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html.slice(0, MAX_HTML).replace(BASE_TAG, "");
}

/**
 * Sanitize custom CSS for embedding inside a `<style>` tag. CSS has no legitimate
 * use for `</style>` or `<script>`, so both are stripped to prevent a breakout that
 * would inject markup into the storefront document.
 */
export function sanitizeInjectedCss(css: string | undefined | null): string {
  if (!css) return "";
  return css.slice(0, MAX_CSS).replace(STYLE_BREAKOUT, "").replace(SCRIPT_TAG_IN_CSS, "");
}

/**
 * Sanitize custom JS for embedding inside a `<script>` tag. A literal `</script` can
 * only legitimately appear inside a JS string or regex, where `<\/script` is
 * equivalent — so we escape it, which closes the breakout without changing behavior.
 */
export function sanitizeInjectedJs(js: string | undefined | null): string {
  if (!js) return "";
  return js.slice(0, MAX_JS).replace(SCRIPT_CLOSE, "<\\/script");
}

/**
 * Sanitize an arbitrary HTML fragment authored in the builder (the `custom_html`
 * section). Same posture as injected head/body HTML: the merchant owns the
 * storefront origin, so we keep their markup but strip `<base>` navigation hijacks.
 */
export function sanitizeHtmlFragment(html: string | undefined | null): string {
  if (!html) return "";
  return html.slice(0, MAX_HTML).replace(BASE_TAG, "");
}

/** The fully-sanitized injection bundle the storefront layout renders. */
export interface SanitizedInjection {
  headHtml: string;
  bodyHtml: string;
  customCss: string;
  customJs: string;
}

/** Sanitize a store's whole `codeInjection` bag for rendering on the storefront. */
export function sanitizeCodeInjection(ci: CodeInjection | undefined | null): SanitizedInjection {
  return {
    headHtml: sanitizeInjectedHtml(ci?.headHtml),
    bodyHtml: sanitizeInjectedHtml(ci?.bodyHtml),
    customCss: sanitizeInjectedCss(ci?.customCss),
    customJs: sanitizeInjectedJs(ci?.customJs),
  };
}
