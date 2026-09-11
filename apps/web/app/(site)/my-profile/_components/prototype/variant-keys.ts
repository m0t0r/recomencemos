/**
 * PROTOTYPE — throwaway; never ships. Lives on `prototype/275-phone-variants`.
 *
 * Three phone-first compositions of `/my-profile` for #275, switchable via
 * `?variant=` on the real route. The content and its order are settled (variant
 * A of the UX lab); what these disagree about is how it sits at 390 px.
 *
 * Keys and names only, and no components: the switcher is a Client Component,
 * and a registry importing the variants would pull server code into the browser.
 */

export const VARIANTS = [
  { key: "A", name: "Una columna" },
  { key: "B", name: "Compacta" },
  { key: "C", name: "Renglones" },
] as const;

export type VariantKey = (typeof VARIANTS)[number]["key"];

export function variantFrom(raw: string | null | undefined): VariantKey {
  return VARIANTS.find((variant) => variant.key === raw)?.key ?? "A";
}
