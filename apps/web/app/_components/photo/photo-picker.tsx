"use client";

/**
 * **The one control for her photo, on every surface that takes one** —
 * `/publish`'s field and `/my-profile`'s own photo. The owner's rule on #275 is
 * that her photo is displayed and managed by **one component, reused**, rather
 * than two that happen to look alike: the picture *is* the control, badged with
 * a camera mark, and tapping it opens the camera roll.
 *
 * **What differs between the two surfaces is passed in, and nothing else is.**
 * A surface says what to call the control, what "ready" means there, and what
 * happens to the key once its bytes are in the store — `/publish` hands it to
 * the form to carry into `publishProfile`; `/my-profile` commits it at once.
 * The journey itself is `usePhotoUpload`'s.
 *
 * **Two shapes of the same component.** `PhotoPicker` stacks the control and
 * its messages, which is what `/publish`'s field wants. `usePhotoPicker` hands
 * the two back separately, for a surface whose control sits where a sentence
 * has no room — `/my-profile`, where the control is the circle in her card's
 * header, and a progress line beside it would push her headline sideways.
 *
 * **The accessibility constraints the control holds on both surfaces:**
 *
 * - **A real `<input type="file">` behind a real `<label>`.** On a 390 px
 *   Android the whole value is the camera roll `accept="image/*"` opens on the
 *   first tap; a `<div>` with a click handler is a keyboard trap and an
 *   unlabelled control. The input is `sr-only`, not `hidden`, so the label has
 *   something to name.
 * - **One tab stop and one name.** The camera mark is a `<span>` inside the one
 *   label, and the picture carries `alt=""` and sits in an `aria-hidden` span,
 *   because it is inside the control it has become: its alt, or its fallback
 *   initial, would join the label's text and name the input twice. The label is
 *   a plain `<label>` styled with `buttonVariants`, never Base UI's `render`,
 *   which puts a second tab stop and button semantics onto it.
 * - **The peer focus ring.** The input precedes the label and shares its parent,
 *   which is what `peer-focus-visible:` compiles to; with the input outside the
 *   wrapper the control has no visible focus state (WCAG 2.2 AA, 2.4.7).
 * - **NFR4's one exemption is said in place of the control.** Unhydrated, a file
 *   input opens a camera roll and then loses the picture, so the sentence stands
 *   where the control would be — never beside a control that does nothing.
 * - **Progress is `role="status"`; a refusal is `FieldError`'s `role="alert"`**,
 *   so one sentence is never announced twice. The status region is rendered
 *   even while empty, because a live region that appears at the moment it has
 *   something to say is one a screen reader misses.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/avatar";
import { buttonVariants } from "@repo/design-system/components/button-variants";
import { FieldDescription, FieldError } from "@repo/design-system/components/field";
import { cn } from "@repo/design-system/lib/utils";
import { PHOTO_INPUT_ACCEPT } from "@repo/storage/limits";
import { CameraIcon, UserRoundIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { type SignPhotoUpload, usePhotoUpload } from "@/app/_lib/photo/use-photo-upload";
import { PHOTO_PREPARING, PHOTO_UPLOADING } from "@/app/_lib/profile-form/messages";

/**
 * What a surface calls the control and its outcomes. Its own voice, its own acts.
 *
 * **A surface either hands the key over or commits it**, and says the sentence
 * that belongs to what it does: `ready` when the key is only handed over, the
 * `committing`/`committed` pair when it is committed at once.
 */
export type PhotoPickerSentences = {
  /** The control's name while there is no photo, and once there is one. */
  readonly choose: string;
  readonly replace: string;
  /** Stands in place of the control until the page has hydrated. */
  readonly needsJavaScript: string;
} & (
  | { readonly ready: string; readonly committing?: never; readonly committed?: never }
  | { readonly ready?: never; readonly committing: string; readonly committed: string }
);

export interface PhotoPickerProps {
  readonly sentences: PhotoPickerSentences;
  /** Whether the page has hydrated. Until it has, the control is inert, so it is not rendered. */
  readonly hydrated: boolean;
  /** `createPhotoUpload`, passed by the surface — see `usePhotoUpload` for why it is not imported. */
  readonly signUpload: SignPhotoUpload;
  /** The photo already there — hers, on her own page. Absent on `/publish`. */
  readonly currentUrl?: string | null;
  /**
   * What the circle shows with no photo: her initial. **Absent means the empty
   * state is a button** rather than a circle, which is `/publish`'s — there is
   * no one yet whose initial to show.
   */
  readonly placeholder?: ReactNode;
  /** Every change to the key that counts; see `usePhotoUpload`. */
  readonly onPhotoKeyChange?: (photoKey: string | null) => void;
  /**
   * Commit a landed key at once. Resolves to a refusal sentence, or to nothing
   * when it took. Where it is absent the key is only handed over.
   */
  readonly commit?: (photoKey: string) => Promise<string | undefined>;
  /** Anything else that describes the control — `/publish`'s help line, her page's photo sentence. */
  readonly describedBy?: string;
  readonly size?: "sm" | "md" | "lg";
}

/** The control and what it says, for a surface that places them apart. */
export interface PhotoPickerParts {
  /** The circle — or, on `/publish` before a pick, the button. The one tab stop. */
  readonly control: ReactNode;
  /** Its progress, its refusal, or why it is waiting for JavaScript. */
  readonly messages: ReactNode;
}

export function usePhotoPicker({
  sentences,
  hydrated,
  signUpload,
  currentUrl = null,
  placeholder,
  onPhotoKeyChange,
  commit,
  describedBy,
  size = "lg",
}: PhotoPickerProps): PhotoPickerParts {
  const inputId = useId();
  const statusId = useId();

  /**
   * **Where a commit stands, kept apart from where the upload stands.** The
   * upload can be `ready` while the commit that follows it is refused — a key
   * that was already used, a profile that went away — and the two answers are
   * about different things, so they are two pieces of state rather than one
   * machine reaching into the other.
   */
  const [commitment, setCommitment] = useState<
    | { readonly step: "none" | "working" | "taken" }
    | { readonly step: "refused"; readonly message: string }
  >({ step: "none" });

  async function commitKey(photoKey: string) {
    if (!commit) return;

    setCommitment({ step: "working" });
    const refusal = await commit(photoKey);
    setCommitment(
      refusal === undefined ? { step: "taken" } : { step: "refused", message: refusal },
    );
  }

  const upload = usePhotoUpload({
    signUpload,
    onPhotoKeyChange: (photoKey) => {
      onPhotoKeyChange?.(photoKey);

      // A new pick starts over: whatever the last commit said is about a
      // picture she has since replaced.
      if (!photoKey) {
        setCommitment({ step: "none" });
        return;
      }

      void commitKey(photoKey);
    },
  });

  /**
   * **A picture that was not saved must not go on looking as if it was.** When
   * the commit is refused the circle goes back to the photo she actually has,
   * and the refusal says why beneath it.
   */
  const shown = commitment.step === "refused" ? currentUrl : (upload.previewUrl ?? currentUrl);
  const refusal =
    upload.state.step === "said"
      ? upload.state.message
      : commitment.step === "refused"
        ? commitment.message
        : null;
  const asPicture = Boolean(shown) || placeholder !== undefined;
  const circle = { sm: "size-16", md: "size-24", lg: "size-32" }[size];

  const announcement =
    upload.state.step === "preparing"
      ? PHOTO_PREPARING
      : upload.state.step === "uploading"
        ? PHOTO_UPLOADING
        : upload.state.step === "ready"
          ? !commit
            ? (sentences.ready ?? "")
            : commitment.step === "taken"
              ? (sentences.committed ?? "")
              : commitment.step === "working"
                ? (sentences.committing ?? "")
                : ""
          : "";

  const picture = (
    <Avatar className={circle}>
      {shown ? <AvatarImage src={shown} alt="" /> : null}
      <AvatarFallback className="font-heading text-3xl">
        {placeholder ?? <UserRoundIcon className="size-10" aria-hidden="true" />}
      </AvatarFallback>
    </Avatar>
  );

  if (!hydrated) {
    return {
      // Her photo still shows; only the way to change it waits for JavaScript.
      control: asPicture ? <div aria-hidden="true">{picture}</div> : null,
      messages: <FieldDescription>{sentences.needsJavaScript}</FieldDescription>,
    };
  }

  return {
    control: (
      <div className="w-fit">
        <input
          id={inputId}
          type="file"
          accept={PHOTO_INPUT_ACCEPT}
          aria-describedby={describedBy ? `${describedBy} ${statusId}` : statusId}
          disabled={upload.busy}
          className="peer sr-only"
          onChange={(event) => {
            void upload.pick(event.target.files?.[0]);
            // Picking the same file again fires no `change` unless the value is cleared.
            event.target.value = "";
          }}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-focus-visible:outline-none",
            asPicture
              ? "group/photo relative block w-fit cursor-pointer rounded-full"
              : cn(buttonVariants({ variant: "outline" }), "peer-focus-visible:border-ring"),
            upload.busy && "pointer-events-none opacity-60",
          )}
        >
          {asPicture ? (
            <>
              <span aria-hidden="true">{picture}</span>
              {/* The affordance: a bare circle does not say it can be tapped. */}
              <span
                aria-hidden="true"
                className="bg-background text-foreground ring-background border-border absolute -right-0.5 -bottom-0.5 grid size-9 place-items-center rounded-full border shadow-sm ring-2 transition-colors duration-150 group-hover/photo:bg-accent"
              >
                <CameraIcon className="size-4" />
              </span>
              <span className="sr-only">{shown ? sentences.replace : sentences.choose}</span>
            </>
          ) : (
            sentences.choose
          )}
        </label>
      </div>
    ),
    messages: (
      <>
        <FieldDescription
          id={statusId}
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
          role="status"
        >
          {announcement}
        </FieldDescription>

        {refusal ? <FieldError>{refusal}</FieldError> : null}
      </>
    ),
  };
}

/** The control with its messages beneath it — the shape `/publish`'s field takes. */
export function PhotoPicker(props: PhotoPickerProps) {
  const { control, messages } = usePhotoPicker(props);

  return (
    <div className="flex flex-col items-start gap-2">
      {control}
      {messages}
    </div>
  );
}
