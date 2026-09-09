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
import { Button } from "@repo/design-system/components/button";
import { buttonVariants } from "@repo/design-system/components/button-variants";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldTitle,
} from "@repo/design-system/components/field";
import { cn } from "@repo/design-system/lib/utils";
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
        tone: "error",
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

      setState({ step: "said", message: PHOTO_UPLOAD_FAILED, tone: "error" });
      URL.revokeObjectURL(preview);
    }
  }

  function remove() {
    // Invalidates any pick still in flight: without this, an upload she started
    // and then removed still resolves and re-attaches itself.
    pickToken.current += 1;
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
          {previewUrl ? (
            // Her own picture, at the size the card will show it. `AvatarImage`
            // is Base UI rather than `next/image`, so a `blob:` URL for bytes
            // that exist only in this tab is fine — and it brings the ring and
            // the fallback the hand-rolled `<img>` had to go without.
            <Avatar className="size-32" aria-describedby={statusId}>
              <AvatarImage src={previewUrl} alt={PHOTO_PREVIEW_ALT} />
              <AvatarFallback>{PHOTO_PREVIEW_ALT.slice(0, 1)}</AvatarFallback>
            </Avatar>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {/*
              **The input precedes the label, and that ordering is the focus
              ring.** The focusable element is the `sr-only` input; the visible
              affordance is the `<label>`, which never receives focus — so
              `buttonVariants`' own `:focus-visible` styles an element the
              keyboard never reaches, and the control had *no* visible focus
              state at all (WCAG 2.2 AA, 2.4.7). Every other `buttonVariants`
              use in this app sits on a natively-focusable `<Link>`, which is
              why the gap was new here. `peer` + `peer-focus-visible:` is the
              fix, and Tailwind's sibling selector only looks *forward*, so the
              input has to come first in the DOM.
            */}
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
              className={cn(
                buttonVariants({ variant: "outline" }),
                "peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                busy && "pointer-events-none opacity-50",
              )}
            >
              {previewUrl ? PHOTO_REPLACE : PHOTO_CHOOSE}
            </label>

            {state.step === "ready" ? (
              <Button type="button" variant="ghost" onClick={remove}>
                {PHOTO_REMOVE}
              </Button>
            ) : null}
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

      {state.step === "said" && state.tone === "error" ? (
        <FieldError>{state.message}</FieldError>
      ) : null}
    </Field>
  );
}
