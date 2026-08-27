/**
 * PROTOTYPE — throwaway. Delete with `sign-in-variants.tsx` when a variant is
 * locked (#12).
 *
 * The variant keys, in a module with **no `"use client"`**, because the page is a
 * Server Component and reads the key off `searchParams` before choosing what to
 * render. Exporting these from the variants file put them on the client boundary,
 * and calling one from the server is an error Next raises at request time rather
 * than at build: _"Attempted to call isVariantKey() from the server but
 * isVariantKey is on the client."_ Found by seam 3, and worth noting that the
 * response was still a **200** — Next's error boundary answered — so a status
 * check alone would have called this working.
 */

export const VARIANTS = {
  A: "Open column",
  B: "Framed card",
  C: "Two doors, named",
} as const;

export type VariantKey = keyof typeof VARIANTS;

export function isVariantKey(value: unknown): value is VariantKey {
  return value === "A" || value === "B" || value === "C";
}
