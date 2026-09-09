"use client";

/**
 * **C — the registry dropzone (`@kibo-ui/dropzone`).**
 *
 * The shadcn ecosystem's answer, and the one the plan comment named. The
 * official `@shadcn` registry has no dropzone — only `input-file`, which is
 * `Input type="file"` plus a `Label` — so this is the nearest real registry
 * component.
 *
 * **Three costs it turned out to have, none of them predicted, and all three
 * belong in the decision rather than in a footnote:**
 *
 * 1. It pulls **`react-dropzone`**, on a route already 43 KB over NFR3's ceiling
 *    ([#234]). Measure before arguing.
 * 2. `shadcn add` also added a package literally called **`cn`** to the design
 *    system's manifest — a second one, beside the repo's own `cn` in
 *    `lib/utils`, which this file imports instead.
 * 3. It wanted to **overwrite `button.tsx`**, and declined by default. This repo
 *    has diverged from registry output before and says so in as many words —
 *    `avatar.tsx`'s header records the `xl` size added at #220 and asks for it to
 *    be re-applied after an overwrite. So taking this component means either
 *    hand-merging its `button` dependency or losing a divergence.
 *
 * The component itself is real and good: drag state, file-type and size
 * rejection surfaced by the component rather than by our copy, and a click path
 * for anyone not dragging.
 *
 * **It is desktop-shaped on a surface whose primary form is 390 px.** There is
 * nothing to drag from on a phone, so the drop affordance is dead chrome and the
 * whole value collapses back to the camera-roll tap A and B already give. Judge
 * it on the desktop adaptation, then ask whether that adaptation is worth what it
 * costs the phone.
 *
 * Throwaway.
 */

import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "@repo/design-system/components/dropzone";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldTitle,
} from "@repo/design-system/components/field";
import { MAX_UPLOAD_BYTES } from "@repo/storage/limits";
import { useId } from "react";
import { usePhotoUpload } from "./use-photo-upload";
import type { VariantProps } from "./variant-b";
import {
  PHOTO_HELP,
  PHOTO_LABEL,
  PHOTO_NOTE,
  PHOTO_PREVIEW_ALT,
} from "@/app/_lib/profile-form/messages";

export function VariantC({ onPhotoKeyChange, hydrated }: VariantProps) {
  const { state, previewUrl, announcement, busy, pick } = usePhotoUpload(onPhotoKeyChange);
  const helpId = useId();
  const statusId = useId();

  return (
    <Field>
      <FieldTitle>{PHOTO_LABEL}</FieldTitle>
      <FieldDescription id={helpId}>{PHOTO_HELP}</FieldDescription>

      {hydrated ? (
        <>
          <Dropzone
            accept={{ "image/*": [] }}
            maxFiles={1}
            maxSize={MAX_UPLOAD_BYTES}
            disabled={busy}
            src={undefined}
            onDrop={(accepted) => {
              void pick(accepted[0]);
            }}
            className="min-h-40"
          >
            <DropzoneEmptyState />
            <DropzoneContent />
          </Dropzone>

          {previewUrl ? (
            // The component shows a file name, not a face. On a surface whose
            // whole argument is that she sees her own photo, the preview still
            // has to be ours — which is itself a finding about the fit.
            // oxlint-disable-next-line next/no-img-element
            <img
              src={previewUrl}
              alt={PHOTO_PREVIEW_ALT}
              aria-describedby={statusId}
              className="bg-muted size-32 rounded-full object-cover"
            />
          ) : null}
        </>
      ) : (
        <FieldDescription>{PHOTO_NOTE}</FieldDescription>
      )}

      <FieldDescription
        id={statusId}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="status"
      >
        {announcement}
      </FieldDescription>

      {state.step === "said" && state.tone === "error" ? (
        <FieldError>{state.message}</FieldError>
      ) : null}
    </Field>
  );
}
