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

import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/avatar";
import { buttonVariants } from "@repo/design-system/components/button-variants";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldTitle,
} from "@repo/design-system/components/field";
import { cn } from "@repo/design-system/lib/utils";
import { PHOTO_INPUT_ACCEPT } from "@repo/storage/limits";
import { CameraIcon, UserRoundIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPhotoUpload } from "../actions";
import { downscale, type DownscaleRefusal } from "../_lib/downscale";
import {
  PHOTO_CHOOSE,
  PHOTO_HELP,
  PHOTO_LABEL,
  PHOTO_NOTE,
  PHOTO_PREPARING,
  PHOTO_READY,
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
   * A refusal in place of progress, and every one of them is a failure now that
   * there is no removal to report. It had a `tone` while _"Quitamos la foto"_
   * existed, so that something she chose was not rendered as something she got
   * wrong; with the remove affordance gone the discriminator had one arm.
   */
  | { readonly step: "said"; readonly message: string };

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

const REFUSALS: Record<DownscaleRefusal, string> = {
  unreadable: PHOTO_UNREADABLE,
  "too-large": PHOTO_TOO_LARGE,
};

export function PhotoField({ onPhotoKeyChange, hydrated }: PhotoFieldProps) {
  const [state, setState] = useState<PhotoStep>({ step: "idle" });
  const inputId = useId();
  const helpId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * **Which pick is still the one that counts.**
   *
   * The comment above `previewUrl` already says she may pick five photos before
   * she likes one, and each pick is two awaits deep — a downscale and a signed
   * upload. Nothing made them exclusive, so two overlapping picks raced and the
   * *slower* one won: it resolved last, so its `onPhotoKeyChange` was the value
   * the form carried into `publishProfile`, and the picture on screen was the
   * other one. She would have published a photo she had replaced.
   *
   * A monotonic token is enough because the loser has nothing to undo — the
   * object it uploaded is an unattached quarantine key, which is the state an
   * abandoned upload already leaves.
   */
  const pickToken = useRef(0);

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

    const token = ++pickToken.current;
    const current = () => token === pickToken.current;

    onPhotoKeyChange(null);
    setState({ step: "preparing" });

    const prepared = await downscale(file);

    if (!current()) return;

    if (!prepared.ok) {
      setState({ step: "said", message: REFUSALS[prepared.reason] });
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

    if (!current()) {
      URL.revokeObjectURL(preview);
      return;
    }

    if (!signed?.data) {
      // The ceiling's own sentence, or a store that is not configured. Both come
      // back as a returned refusal with copy already written for her.
      setState({
        step: "said",
        message: signed?.serverError?.message ?? PHOTO_UPLOAD_FAILED,
      });
      URL.revokeObjectURL(preview);
      return;
    }

    try {
      const response = await fetch(signed.data.uploadUrl, {
        method: "PUT",
        body: blob,
        // All three are covered by the signature, so a mismatch is a refusal
        // from the store rather than something this code has to check — and
        // `If-None-Match` is not optional politeness: it is a *signed* header,
        // so dropping it invalidates the signature. It is what makes the URL a
        // single write rather than a five-minute window in which the object an
        // Admin reviewed can be swapped for another. See `presignUpload`.
        headers: { "Content-Type": contentType, "If-None-Match": "*" },
      });

      if (!response.ok) throw new Error(String(response.status));

      if (!current()) {
        URL.revokeObjectURL(preview);
        return;
      }

      setState({ step: "ready", previewUrl: preview, photoKey: signed.data.photoKey });
      onPhotoKeyChange(signed.data.photoKey);
    } catch {
      if (!current()) {
        URL.revokeObjectURL(preview);
        return;
      }

      setState({ step: "said", message: PHOTO_UPLOAD_FAILED });
      URL.revokeObjectURL(preview);
    }
  }

  /**
   * **Progress only, because a refusal is already announced next door.**
   * `FieldError` renders `role="alert"`, so routing the same sentence through
   * this `role="status"` too printed it twice — muted, then red — and announced
   * it twice, once assertively and once politely. Seen running, not reasoned
   * about.
   */
  const announcement =
    state.step === "preparing"
      ? PHOTO_PREPARING
      : state.step === "uploading"
        ? PHOTO_UPLOADING
        : state.step === "ready"
          ? PHOTO_READY
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
      <FieldTitle>{PHOTO_LABEL}</FieldTitle>
      <FieldDescription id={helpId}>{PHOTO_HELP}</FieldDescription>

      {/*
        **The sentence stands *in place of* the control, rather than beside it.**

        This was a `<noscript>` wrapping the sentence while the input stayed a
        sibling — and `<noscript>` gates only its own children, never its
        siblings, so the served document carried the explanation *and* a working
        camera-roll button that then did nothing. Exactly the outcome
        `.impeccable/briefs/photo.md` refuses: "the no-JS branch renders the
        sentence in place of the control rather than rendering a control that
        does nothing."

        `hydrated` is the right condition and `<noscript>` is not, because it
        covers both ways the control can be inert — JavaScript disabled, and
        JavaScript enabled but not yet hydrated. `SkillPicker` is the prior art
        (`field-groups.tsx`), and the flag comes from the same machine.
      */}
      {hydrated ? (
        <>
          {/*
            **The wrapper exists because `Field` sets `*:w-full` on its own
            direct children**, at a specificity (0,1,1) no `size-*` class on the
            child can beat. Without it the picture below rendered 358 × 128 on a
            390 px screen — a letterboxed ellipse with her chin cropped off,
            which is what shipped.

            **The input and the label both live inside it, and that pairing is
            the focus ring.** The focusable element is the `sr-only` input; the
            visible affordance is the `<label>`, which never receives focus — so
            a `:focus-visible` rule on the label styles an element the keyboard
            never reaches, and the control would have *no* visible focus state at
            all (WCAG 2.2 AA, 2.4.7). `peer` + `peer-focus-visible:` is the fix,
            and it compiles to a *sibling* combinator that looks only forward:
            the input has to precede the label **and share a parent with it**.
            Leaving the input outside this wrapper silently dropped the ring,
            which a real Tab caught and reading the class list would not have.
          */}
          <div className="w-full">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={PHOTO_INPUT_ACCEPT}
              aria-describedby={`${helpId} ${statusId}`}
              disabled={busy}
              // `sr-only` rather than `hidden`: the input has to stay in the
              // accessibility tree for the label to name anything.
              className="peer sr-only"
              onChange={(event) => {
                void pick(event.target.files?.[0]);
              }}
            />

            {/*
              **One control in both states, and once she has picked, the picture
              *is* it.** `.impeccable/briefs/photo.md`: _"the control is replaced
              by the picture itself … There is no second 'remove' affordance
              hiding in a corner: pick again is the whole interaction."_ What
              shipped before was the opposite — the picture appeared *above* an
              unchanged button and a third control beside it, so the one object
              she is deciding about was spread across three targets.

              **`buttonVariants` on a plain `<label>`, never `<Button
              render={<label/>}>`.** This is `own-profile-view.tsx`'s rule
              applied to the other native element, and for the same reason: Base
              UI's `render` puts button semantics onto whatever it is handed.
              Driven against the running server, that produced a `<label>`
              carrying its own `tabindex` and `onclick` — so one control had two
              tab stops and the input announced as a button rather than as a file
              input. A label needs neither; the browser's own `htmlFor`
              behaviour is the whole interaction.
            */}
            <label
              htmlFor={inputId}
              className={cn(
                "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-focus-visible:outline-none",
                previewUrl
                  ? "group/photo relative block w-fit cursor-pointer rounded-full"
                  : cn(buttonVariants({ variant: "outline" }), "peer-focus-visible:border-ring"),
                busy && "pointer-events-none opacity-60",
              )}
            >
              {previewUrl ? (
                <>
                  {/*
                    **`alt=""`, and that is the one place this deviates from the
                    brief's letter.** The brief asks the preview to carry an alt
                    saying what it shows, and it was written for a preview that
                    sat *beside* a button. Here the picture is inside the control
                    it has become, so an alt would join the label's text and name
                    the input twice — "La foto que elegiste, Elegir otra" — which
                    is the exact two-names bug `FieldTitle` was demoted to fix.
                    The verb names the control; the `role="status"` line below,
                    already joined by `aria-describedby`, says what happened to
                    the picture.
                  */}
                  <Avatar className="size-32">
                    <AvatarImage src={previewUrl} alt="" />
                    <AvatarFallback>
                      <UserRoundIcon className="size-10" aria-hidden="true" />
                    </AvatarFallback>
                  </Avatar>

                  {/*
                    The affordance, because a bare circle does not say it can be
                    tapped. It is a `<span>` inside the one `<label>` rather than
                    a control of its own: one tab stop, one name, and nothing new
                    in the accessibility tree.
                  */}
                  <span
                    aria-hidden="true"
                    className="bg-background text-foreground ring-background border-border absolute -right-0.5 -bottom-0.5 grid size-9 place-items-center rounded-full border shadow-sm ring-2 transition-colors duration-150 group-hover/photo:bg-accent"
                  >
                    <CameraIcon className="size-4" />
                  </span>

                  <span className="sr-only">{PHOTO_REPLACE}</span>
                </>
              ) : (
                PHOTO_CHOOSE
              )}
            </label>
          </div>
        </>
      ) : (
        <FieldDescription>{PHOTO_NOTE}</FieldDescription>
      )}

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

      {state.step === "said" ? <FieldError>{state.message}</FieldError> : null}
    </Field>
  );
}
