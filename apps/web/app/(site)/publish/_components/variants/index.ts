/**
 * The three `/prototype` UI variants of `/publish`, and what every one is
 * given. Structurally different by construction — order, hierarchy and the
 * primary affordance differ, not the colours — and each is free to throw out
 * the others' layout entirely. What they share is the field components in
 * `../fields.tsx` and the picker, which is the "shared `<Header>`" the skill
 * allows rather than the shared `<Layout>` it forbids.
 *
 * **Locking one is the human's call.** When it is locked, the winner's file
 * becomes the layout, the losers and `PrototypeSwitcher` move to the
 * throwaway branch, and this registry goes with them.
 */

import type { ComponentType } from "react";
import type { PublishFieldName } from "../../_lib/messages";
import type { PublishMachine } from "../../_lib/use-publish";
import type { PublishForm } from "../../_lib/use-publish-form";
import type { VocabularyEntry } from "../skill-picker";
import { ByVisibility } from "./by-visibility";
import { IdentityFirst } from "./identity-first";
import { WithPreview } from "./with-preview";

export interface VariantProps {
  readonly form: PublishForm;
  readonly machine: PublishMachine;
  readonly vocabulary: readonly VocabularyEntry[];
  readonly idFor: (field: PublishFieldName, index?: number) => string;
  readonly serverErrorFor: (field: PublishFieldName, index?: number) => string | undefined;
}

export const VARIANTS = {
  A: { name: "Por lo que ves", component: ByVisibility },
  B: { name: "Con vista previa", component: WithPreview },
  C: { name: "Primero quién eres", component: IdentityFirst },
} as const satisfies Record<string, { name: string; component: ComponentType<VariantProps> }>;

export type VariantKey = keyof typeof VARIANTS;

export const VARIANT_KEYS = Object.keys(VARIANTS) as readonly VariantKey[];

export function isVariantKey(value: unknown): value is VariantKey {
  return typeof value === "string" && value in VARIANTS;
}

export const DEFAULT_VARIANT: VariantKey = "A";
