/**
 * The three variants and their names, for the switcher's label.
 *
 * Throwaway — this whole folder leaves `dev` once one wins.
 */

export { VariantA } from "./variant-a";
export { VariantB } from "./variant-b";
export { VariantC } from "./variant-c";
export type { VariantProps } from "./variant-b";

export const PHOTO_VARIANTS = [
  { key: "A", name: "label and picture — what ships" },
  { key: "B", name: "the picture is the control" },
  { key: "C", name: "registry dropzone" },
] as const;
