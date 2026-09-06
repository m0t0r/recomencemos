/**
 * **Prototype only.** The five `?variant=` compositions of the two profile
 * forms on `prototype/181-ui-variants`, and the treatment each one is.
 *
 * The question the owner is answering is **how far the notebook world is taken
 * on a form, and where her own words come back to her** — so the variants
 * differ in exactly that and in nothing else. Field order, group boundaries,
 * legends, help, refusals and the summary's position are settled in the two
 * briefs and every variant inherits them unchanged; a variant that moved one
 * would be answering a question nobody asked.
 *
 * `E` is what `dev` renders today and is last in the list rather than first,
 * because a control read after the alternatives is read as a control and a
 * control read first is read as the default.
 *
 * When one is locked, its values are inlined into the two layouts and this
 * module, `treatment.ts`, `preview-bar.tsx` and `prototype-switcher.tsx` leave
 * with the losers.
 */

import type { FormTreatment } from "./treatment";

export const VARIANTS = {
  A: {
    name: "Renglones",
    treatment: {
      sheets: false,
      displayHeadings: true,
      inkControls: false,
      preview: "none",
    },
  },
  B: {
    name: "La página reglada",
    treatment: {
      sheets: true,
      displayHeadings: true,
      inkControls: false,
      preview: "closing",
    },
  },
  C: {
    name: "La ficha al pulgar",
    treatment: {
      sheets: true,
      displayHeadings: true,
      inkControls: false,
      preview: "thumb",
    },
  },
  D: {
    name: "La libreta",
    treatment: {
      sheets: true,
      displayHeadings: true,
      inkControls: true,
      preview: "closing",
    },
  },
  E: {
    name: "Actual",
    treatment: {
      sheets: false,
      displayHeadings: false,
      inkControls: false,
      preview: "none",
    },
  },
} as const satisfies Record<string, { name: string; treatment: FormTreatment }>;

export type VariantKey = keyof typeof VARIANTS;

export const VARIANT_KEYS = Object.keys(VARIANTS) as readonly VariantKey[];

export function isVariantKey(value: unknown): value is VariantKey {
  return typeof value === "string" && value in VARIANTS;
}

export const DEFAULT_VARIANT: VariantKey = "B";

export function treatmentFor(value: unknown): FormTreatment {
  return VARIANTS[isVariantKey(value) ? value : DEFAULT_VARIANT].treatment;
}
