/** Tiny classname joiner — drops falsy values. Mirrors the prototype's `cx`. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
