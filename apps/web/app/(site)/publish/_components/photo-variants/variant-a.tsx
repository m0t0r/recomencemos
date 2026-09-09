"use client";

/**
 * **A — the label and the picture. What ships today.**
 *
 * A `<label>` styled as a button in front of an `sr-only` `<input type="file">`,
 * the preview appearing above it once she picks, and a third control to remove.
 *
 * The incumbent, here so the other two are judged against something real rather
 * than against a memory of it. It is a thin wrapper over the shipped component
 * on purpose: any difference between this and `/publish` without a `?variant=`
 * would make the comparison a lie.
 *
 * Its weakness is the one the review found: **the brief describes B, not A** —
 * _"the control is replaced by the picture itself… There is no second 'remove'
 * affordance."_ So either A is right and the brief is stale, or the brief was
 * right and A drifted. That is the thing to decide by looking.
 *
 * Throwaway.
 */

import { PhotoField } from "../photo-field";
import type { VariantProps } from "./variant-b";

export function VariantA({ onPhotoKeyChange, hydrated }: VariantProps) {
  return <PhotoField onPhotoKeyChange={onPhotoKeyChange} hydrated={hydrated} />;
}
