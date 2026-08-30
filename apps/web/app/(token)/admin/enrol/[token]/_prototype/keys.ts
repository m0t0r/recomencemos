/**
 * PROTOTYPE — throwaway. The variant keys, in a module with no `"use client"`
 * on it, because the page reads the search param on the server and the switcher
 * renders in the browser. Exporting `readVariant` from the client module made
 * the page call a client function from the server, which is a 500.
 */

export const VARIANTS = {
  A: "Sequential — QR, then codes",
  B: "Codes first — the half with no second chance",
  C: "Two columns — neither act below the other",
} as const;

export type VariantKey = keyof typeof VARIANTS;

export const VARIANT_KEYS = Object.keys(VARIANTS) as VariantKey[];

export function readVariant(value: string | undefined): VariantKey {
  return VARIANT_KEYS.includes(value as VariantKey) ? (value as VariantKey) : "A";
}
