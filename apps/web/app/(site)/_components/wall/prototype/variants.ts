/** PROTOTYPE — the variant keys, importable from server and client alike. */

export const VARIANTS = [
  { key: "E", name: "El índice, móvil" },
  { key: "F", name: "Los oficios, móvil" },
  { key: "G", name: "El tablero, móvil" },
  { key: "A", name: "El índice" },
  { key: "B", name: "El tablero" },
  { key: "C", name: "Los oficios" },
  { key: "D", name: "Actual" },
] as const;

export type VariantKey = (typeof VARIANTS)[number]["key"];

export function variantFrom(value: string | string[] | null | undefined): VariantKey {
  const found = VARIANTS.find((v) => v.key === value);
  return found ? found.key : "E";
}
