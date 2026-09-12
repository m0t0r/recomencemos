"use client";

/**
 * The photo step — DD6 steps 1 and 2 from the browser's side.
 *
 * **She never waits for it, and that is the whole shape.** Picking a photo
 * starts a downscale and an upload that run beside the rest of the form; the
 * submit is never disabled and the form is never blocked. If she publishes
 * before the transfer finishes, the profile goes live without the photo — which
 * is the sentence the help line has been making all along, and is why losing the
 * race costs her nothing that matters.
 *
 * **The control is `PhotoPicker`, the one component for her photo on every
 * surface** (#275). What is here is this surface's half: the field's title and
 * help line, its sentences, and handing the key to the form — never attaching
 * it, because there is no profile to attach it to until she publishes.
 *
 * **`Field` sets `*:w-full` on its direct children**, at a specificity no
 * `size-*` on a grandchild can beat, so the picker sits in a wrapper of its own:
 * given the field's full width, the circle stretches to 358 × 128 on a 390 px
 * screen — a letterboxed ellipse with her chin cropped off.
 */

import { Field, FieldDescription, FieldTitle } from "@repo/design-system/components/field";
import * as React from "react";
import { PhotoPicker } from "@/app/_components/photo/photo-picker";
import {
  PHOTO_CHOOSE,
  PHOTO_HELP,
  PHOTO_LABEL,
  PHOTO_NOTE,
  PHOTO_READY,
  PHOTO_REPLACE,
} from "@/app/_lib/profile-form/messages";
import { createPhotoUpload } from "../actions";

export interface PhotoFieldProps {
  /**
   * Told to the form, which carries it into `publishProfile` as a bound
   * argument — never as a hidden input (ADR-0015). `null` whenever there is no
   * photo to attach, which includes every state but `ready`.
   */
  readonly onPhotoKeyChange: (photoKey: string | null) => void;

  /**
   * Whether the page has hydrated, from the same machine the rest of the form
   * reads. Until it has, the control is inert — a camera roll that opens and
   * then loses the picture — so the sentence stands in its place instead.
   */
  readonly hydrated: boolean;
}

const SENTENCES = {
  choose: PHOTO_CHOOSE,
  replace: PHOTO_REPLACE,
  ready: PHOTO_READY,
  needsJavaScript: PHOTO_NOTE,
} as const;

export function PhotoField({ onPhotoKeyChange, hydrated }: PhotoFieldProps) {
  const helpId = React.useId();

  return (
    <Field>
      {/*
        **The field's title is a paragraph, and the *label* is the trigger.**
        Both were labels once, and the accessibility tree said so out loud: the
        input came out named "Tu foto Elegir una foto", two labels concatenated
        into one name. A control has one name, and the useful one is the verb.
      */}
      <FieldTitle>{PHOTO_LABEL}</FieldTitle>
      <FieldDescription id={helpId}>{PHOTO_HELP}</FieldDescription>

      <div className="w-full">
        <PhotoPicker
          sentences={SENTENCES}
          hydrated={hydrated}
          signUpload={createPhotoUpload}
          onPhotoKeyChange={onPhotoKeyChange}
          describedBy={helpId}
        />
      </div>
    </Field>
  );
}
