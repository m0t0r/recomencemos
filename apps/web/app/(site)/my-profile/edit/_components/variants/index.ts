/**
 * The three `/prototype` UI variants of `/my-profile/edit`, and what every one
 * is given. They answer the three open decisions at the end of
 * `.impeccable/briefs/edit-profile.md`, and they disagree about structure
 * rather than about colour:
 *
 * | | one page or one section | the way in from `/my-profile` | where the save sits |
 * | --- | --- | --- | --- |
 * | **A** | one page, all four groups | one _Cambiar mi perfil_ control | at the end |
 * | **B** | one section at a time | one link per section | at the end |
 * | **C** | one page, plus an index | one control, plus the index on the page | pinned on a phone |
 *
 * What they share is the field groups and the machine — the "shared `<Header>`"
 * the `/prototype` skill allows rather than the shared `<Layout>` it forbids.
 *
 * **Locking one is the human's call.** When it is locked, the winner becomes
 * the layout, and the losers, `PrototypeSwitcher` and this registry stay on
 * `prototype/142-ui-variants`.
 */

import type { ComponentType } from "react";
import type { PublishFieldName } from "@/app/_lib/profile-form/messages";
import type { ProfileFieldsForm } from "@/app/_lib/profile-form/use-profile-fields";
import type { ProfileFormMachine } from "@/app/_lib/profile-form/use-profile-form";
import type { VocabularyEntry } from "@/app/_components/profile-form/skill-picker";
import { AllVisible } from "./all-visible";
import { OneSection } from "./one-section";
import { PinnedSave } from "./pinned-save";

export interface VariantProps {
  readonly form: ProfileFieldsForm;
  readonly machine: ProfileFormMachine;
  readonly vocabulary: readonly VocabularyEntry[];
  readonly idFor: (field: PublishFieldName, index?: number) => string;
  readonly serverErrorFor: (field: PublishFieldName, index?: number) => string | undefined;
  /**
   * The group she arrived at, from `?group=`. Only variant B reads it; the
   * other two show every group at once and have nothing to open.
   */
  readonly openGroup?: string | undefined;
}

export const VARIANTS = {
  A: { name: "Todo a la vista", component: AllVisible },
  B: { name: "Una sección a la vez", component: OneSection },
  C: { name: "Índice y guardar fijo", component: PinnedSave },
} as const satisfies Record<string, { name: string; component: ComponentType<VariantProps> }>;

export type VariantKey = keyof typeof VARIANTS;

export const VARIANT_KEYS = Object.keys(VARIANTS) as readonly VariantKey[];

export function isVariantKey(value: unknown): value is VariantKey {
  return typeof value === "string" && value in VARIANTS;
}

export const DEFAULT_VARIANT: VariantKey = "A";
