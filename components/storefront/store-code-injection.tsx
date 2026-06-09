import type { CodeInjection } from "@/types";
import { sanitizeCodeInjection } from "@/lib/sanitize/inject";

/**
 * Renders a store's global code injection (Stage 11, PRD §6.3) onto its storefront.
 * Everything here is sanitized first (see `lib/sanitize/inject` for the threat model
 * and the documented self-XSS scope) and rendered only inside the `(store)` route
 * group — the admin/marketing shells never emit it.
 *
 * Placement:
 *  • Custom CSS → a `<style>` with a `precedence`, which React 19 hoists into the
 *    document `<head>` and dedupes by `href`.
 *  • Head HTML → emitted at the top of the storefront body. A nested route-group
 *    layout can't write raw strings into the real `<head>`, but because the page is
 *    server-rendered, any `<script>`/`<link>`/pixel in this string is present in the
 *    initial HTML response and executes on parse — which covers analytics, tag
 *    managers, and chat widgets. (SEO-critical meta is handled separately by the
 *    per-page Metadata API, so it always lands in `<head>`.)
 *  • Body HTML + custom JS → emitted at the very end of the storefront body.
 */

export function StoreInjectionHead({ injection }: { injection?: CodeInjection }) {
  const { customCss, headHtml } = sanitizeCodeInjection(injection);
  return (
    <>
      {customCss ? (
        <style
          // React 19 hoists styles carrying a precedence into <head>; href dedupes.
          href="offshelf-store-custom-css"
          precedence="high"
          dangerouslySetInnerHTML={{ __html: customCss }}
        />
      ) : null}
      {headHtml ? (
        <span hidden dangerouslySetInnerHTML={{ __html: headHtml }} suppressHydrationWarning />
      ) : null}
    </>
  );
}

export function StoreInjectionBody({ injection }: { injection?: CodeInjection }) {
  const { bodyHtml, customJs } = sanitizeCodeInjection(injection);
  return (
    <>
      {bodyHtml ? (
        <span hidden dangerouslySetInnerHTML={{ __html: bodyHtml }} suppressHydrationWarning />
      ) : null}
      {customJs ? <script dangerouslySetInnerHTML={{ __html: customJs }} /> : null}
    </>
  );
}
