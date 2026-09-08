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
 * **The control is a real `<input type="file">` behind a real `<label>`**, not a
 * `<div>` with a click handler. On a 390 px Android the whole value is the
 * camera roll that `accept="image/*"` opens on the first tap, and a hand-rolled
 * target is a keyboard trap and an unlabelled control for anyone not using a
 * finger. The input is visually hidden rather than absent — it has to be in the
 * accessibility tree, and `hidden` or `display: none` would take it out.
 *
 * **NFR4: this is the one field that cannot work without JavaScript**, and the
 * form says so where the field is rather than in a footnote. The unhydrated
 * branch renders `PHOTO_NOTE` in place of the control — a sentence rather than a
 * button that would do nothing.
 *
 * **Nothing here is a security control.** The downscale is a courtesy to her
 * mobile data; the ceiling is enforced by the signature on the presigned URL,
 * and the format is decided by the server-side re-encode from the bytes
 * themselves. This code running or not changes nothing about what the store
 * accepts.
 */

import { Button } from "@repo/design-system/components/button";
import { buttonVariants } from "@repo/design-system/components/button-variants";
import { Field, FieldDescription, FieldError } from "@repo/design-system/components/field";
import { PHOTO_INPUT_ACCEPT } from "@repo/storage/limits";
import { useEffect, useId, useRef, useState } from "react";
import { createPhotoUpload } from "../actions";
import { downscale, type DownscaleRefusal } from "../_lib/downscale";
import {
  PHOTO_CHOOSE,
  PHOTO_HELP,
  PHOTO_LABEL,
  PHOTO_NOTE,
  PHOTO_PREPARING,
  PHOTO_PREVIEW_ALT,
  PHOTO_READY,
  PHOTO_REMOVE,
  PHOTO_REMOVED,
  PHOTO_REPLACE,
  PHOTO_TOO_LARGE,
  PHOTO_UNREADABLE,
  PHOTO_UPLOAD_FAILED,
  PHOTO_UPLOADING,
} from "@/app/_lib/profile-form/messages";

/**
 * Where the picture is in its journey from her camera roll to quarantine.
 *
 * Five rather than three: `preparing` and `uploading` are separate because they
 * fail differently and because on a 5 MB phone photo the first one is a real
 * wait rather than a flash — the brief's _States and ranges_ says so, and a
 * single "loading" would be the sentence that describes neither.
 */
type PhotoStep =
  | { readonly step: "idle" }
  | { readonly step: "preparing" }
  | { readonly step: "uploading"; readonly previewUrl: string }
  | { readonly step: "ready"; readonly previewUrl: string; readonly photoKey: string }
  /**
   * A sentence in place of progress. `tone` is what keeps a removal from
   * rendering as a failure: taking her own photo off is something she chose,
   * and a `FieldError` under it would be the form telling her she got something
   * wrong.
   */
  | { readonly step: "said"; readonly message: string; readonly tone: "error" | "note" };

export interface PhotoFieldProps {
  /**
   * Told to the form, which carries it into `publishProfile` as a bound
   * argument — never as a hidden input (ADR-0015). `null` whenever there is no
   * photo to attach, which includes every state but `ready`.
   */
  readonly onPhotoKeyChange: (photoKey: string | null) => void;
}

const REFUSALS: Record<DownscaleRefusal, string> = {
  unreadable: PHOTO_UNREADABLE,
  "too-large": PHOTO_TOO_LARGE,
};

export function PhotoField({ onPhotoKeyChange }: PhotoFieldProps) {
  const [state, setState] = useState<PhotoStep>({ step: "idle" });
  const inputId = useId();
  const helpId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * **An object URL is a document-lifetime allocation, not a value.** Each
   * preview holds the decoded blob alive until it is revoked, and she may pick
   * five photos before she likes one — so the previous one is released whenever
   * this one changes, and the last one on unmount.
   */
  const previewUrl = "previewUrl" in state ? state.previewUrl : null;
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function pick(file: File | undefined) {
    if (!file) return;

    onPhotoKeyChange(null);
    setState({ step: "preparing" });

    const prepared = await downscale(file);

    if (!prepared.ok) {
      setState({ step: "said", message: REFUSALS[prepared.reason], tone: "error" });
      return;
    }

    const { blob, contentType, byteLength, previewUrl: preview } = prepared.photo;
    setState({ step: "uploading", previewUrl: preview });

    /**
     * **Two round trips, and the first one is the only one that is ours.**
     * `createPhotoUpload` charges NFR26's ceiling and signs a URL; the PUT then
     * goes straight to the object store, which is DD6's correction — a multipart
     * Server Action would hit Next's 1 MB body limit and buffer the bytes in a
     * process with a 1 GB floor.
     */
    const signed = await createPhotoUpload({ byteLength, contentType });

    if (!signed?.data) {
      // The ceiling's own sentence, or a store that is not configured. Both come
      // back as a returned refusal with copy already written for her.
      setState({
        step: "said",
        message: signed?.serverError?.message ?? PHOTO_UPLOAD_FAILED,
        tone: "error",
      });
      URL.revokeObjectURL(preview);
      return;
    }

    try {
      const response = await fetch(signed.data.uploadUrl, {
        method: "PUT",
        body: blob,
        // Both are covered by the signature, so a mismatch is a refusal from the
        // store rather than something this code has to check.
        headers: { "Content-Type": contentType },
      });

      if (!response.ok) throw new Error(String(response.status));

      setState({ step: "ready", previewUrl: preview, photoKey: signed.data.photoKey });
      onPhotoKeyChange(signed.data.photoKey);
    } catch {
      setState({ step: "said", message: PHOTO_UPLOAD_FAILED, tone: "error" });
      URL.revokeObjectURL(preview);
    }
  }

  function remove() {
    onPhotoKeyChange(null);
    setState({ step: "said", message: PHOTO_REMOVED, tone: "note" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const announcement =
    state.step === "preparing"
      ? PHOTO_PREPARING
      : state.step === "uploading"
        ? PHOTO_UPLOADING
        : state.step === "ready"
          ? PHOTO_READY
          : state.step === "said"
            ? state.message
            : "";

  const busy = state.step === "preparing" || state.step === "uploading";

  return (
    <Field>
      {/*
        **The field's title is a paragraph, and the *label* is the trigger.**
        Both were labels once, and the accessibility tree said so out loud: the
        input came out named "Tu foto Elegir una foto", two labels concatenated
        into one name. A control has one name, and the useful one is the verb.
      */}
      <p className="text-foreground text-sm font-medium">{PHOTO_LABEL}</p>
      <FieldDescription id={helpId}>{PHOTO_HELP}</FieldDescription>

      {/*
        **The whole control lives inside `<noscript>`'s complement.** Without
        JavaScript the browser renders the `<noscript>` sentence and never the
        input, which is NFR4's exception honoured rather than apologised for —
        an input that opened a camera roll and then did nothing would be worse
        than none.
      */}
      <noscript>
        <p className="text-muted-foreground text-sm leading-5">{PHOTO_NOTE}</p>
      </noscript>

      {previewUrl ? (
        // Her own picture, at the size the card will show it. Not `next/image`:
        // this is a `blob:` URL for bytes that exist only in this tab.
        // oxlint-disable-next-line next/no-img-element
        <img
          src={previewUrl}
          alt={PHOTO_PREVIEW_ALT}
          aria-describedby={statusId}
          className="bg-muted size-32 rounded-full object-cover"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {/*
          A `<label>` styled as a button and pointing at a real input, rather
          than a button that clicks a hidden input for you: the label *is* the
          accessible name of the control, so a screen reader announces one thing
          instead of two, and the keyboard path is the browser's own.
        */}
        {/*
          **`buttonVariants` on a plain `<label>`, never `<Button render={<label/>}>`.**
          This is `own-profile-view.tsx`'s rule applied to the other native
          element, and for the same reason: Base UI's `render` puts button
          semantics onto whatever it is handed. Driven against the running
          server, that produced a `<label>` carrying its own `tabindex` and
          `onclick` — so one control had two tab stops and the input announced
          as a button rather than as a file input. A label needs neither; the
          browser's own `htmlFor` behaviour is the whole interaction.
        */}
        <label
          htmlFor={inputId}
          className={buttonVariants({
            variant: "outline",
            className: busy ? "pointer-events-none opacity-50" : undefined,
          })}
        >
          {previewUrl ? PHOTO_REPLACE : PHOTO_CHOOSE}
        </label>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={PHOTO_INPUT_ACCEPT}
          aria-describedby={`${helpId} ${statusId}`}
          disabled={busy}
          // `sr-only` rather than `hidden`: the input has to stay in the
          // accessibility tree for the label above to name anything.
          className="sr-only"
          onChange={(event) => {
            void pick(event.target.files?.[0]);
          }}
        />

        {state.step === "ready" ? (
          <Button type="button" variant="ghost" onClick={remove}>
            {PHOTO_REMOVE}
          </Button>
        ) : null}
      </div>

      {/*
        One region for every step, announced politely. A picture appearing is not
        an announcement, which is why the sentence carries the state rather than
        the image carrying a badge — `.impeccable/briefs/photo.md`, and the whole
        of the dignity argument on the surface next door.
      */}
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
