"use client";

/**
 * **B — the picture is the control.**
 *
 * One circle, and it is both the affordance and the result. Empty, it is a
 * dashed ring carrying her initial and the verb underneath, sized as a tap
 * target rather than as a button. Filled, it is her photo, and tapping it opens
 * the camera roll again.
 *
 * No second button, no separate preview, no remove — removing is choosing
 * nothing, and the copy already says a profile costs her nothing without a
 * photo.
 *
 * This is what `.impeccable/briefs/photo.md` actually describes: _"the control is
 * replaced by the picture itself… There is no second 'remove' affordance."_ A
 * ships three targets where the brief asked for one.
 *
 * On 390 px it is the smallest of the three: one target, and the control and its
 * result are the same object rather than two things read together. The risk is
 * discoverability, which is what looking at it settles.
 *
 * Throwaway.
 */

import {
  Field,
  FieldDescription,
  FieldError,
  FieldTitle,
} from "@repo/design-system/components/field";
import { PHOTO_INPUT_ACCEPT } from "@repo/storage/limits";
import { useId } from "react";
import { usePhotoUpload } from "./use-photo-upload";
import {
  PHOTO_CHOOSE,
  PHOTO_HELP,
  PHOTO_LABEL,
  PHOTO_NOTE,
  PHOTO_PREVIEW_ALT,
  PHOTO_REPLACE,
} from "@/app/_lib/profile-form/messages";

export interface VariantProps {
  readonly onPhotoKeyChange: (photoKey: string | null) => void;
  readonly hydrated: boolean;
  readonly firstName: string;
}

export function VariantB({ onPhotoKeyChange, hydrated, firstName }: VariantProps) {
  const { state, previewUrl, announcement, busy, inputRef, pick } =
    usePhotoUpload(onPhotoKeyChange);
  const inputId = useId();
  const helpId = useId();
  const statusId = useId();

  return (
    <Field>
      <FieldTitle>{PHOTO_LABEL}</FieldTitle>
      <FieldDescription id={helpId}>{PHOTO_HELP}</FieldDescription>

      {hydrated ? (
        <>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={PHOTO_INPUT_ACCEPT}
            aria-describedby={`${helpId} ${statusId}`}
            disabled={busy}
            className="peer sr-only"
            onChange={(event) => {
              void pick(event.target.files?.[0]);
            }}
          />

          {/*
            The whole control. A `<label>` so the keyboard path is the browser's
            own and the input keeps its one accessible name; `peer-focus-visible`
            because the focusable element is the input, which is invisible.
          */}
          <label
            htmlFor={inputId}
            className={[
              "group relative flex size-40 cursor-pointer items-center justify-center",
              "rounded-full border-2 border-dashed border-border bg-muted/40",
              "text-muted-foreground transition-colors",
              "hover:border-ring hover:bg-muted",
              "peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
              busy ? "pointer-events-none opacity-50" : "",
              previewUrl ? "border-solid border-transparent bg-transparent" : "",
            ].join(" ")}
          >
            {previewUrl ? (
              // oxlint-disable-next-line next/no-img-element
              <img
                src={previewUrl}
                alt={PHOTO_PREVIEW_ALT}
                className="size-full rounded-full object-cover"
              />
            ) : (
              <span aria-hidden="true" className="text-4xl font-medium">
                {firstName.trim().slice(0, 1).toUpperCase() || "?"}
              </span>
            )}

            <span className="sr-only">{previewUrl ? PHOTO_REPLACE : PHOTO_CHOOSE}</span>
          </label>

          <FieldDescription className="text-center">
            {previewUrl ? PHOTO_REPLACE : PHOTO_CHOOSE}
          </FieldDescription>
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
