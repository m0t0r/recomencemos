/**
 * PROTOTYPE — throwaway. Delete with the losing variants.
 *
 * The half of the variant switcher a **server** component needs, kept out of the
 * `"use client"` module for the reason that boundary exists: a plain function
 * exported from a client module cannot be *called* on the server, only rendered
 * as a component or passed as a prop. Doing it the other way round gives
 * _"Attempted to call variantFrom() from the server but variantFrom is on the
 * client"_ at render — a 500 on a page that builds and type-checks.
 *
 * Lifted from #24's prototype commit (`e387d02`), which never reached `dev`.
 */

export interface PrototypeVariant {
  readonly key: string;
  /** What this composition is, in the words the hand-over uses. */
  readonly name: string;
}

/** The key a route is on, normalised. Unknown or absent reads as the first. */
export function variantFrom(
  raw: string | undefined,
  variants: readonly PrototypeVariant[],
): string {
  const key = raw?.toLowerCase() ?? "";
  return variants.some((variant) => variant.key === key) ? key : (variants[0]?.key ?? "a");
}
