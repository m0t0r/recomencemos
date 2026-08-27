"use client";

/**
 * **Variant A — "Open column".** No card, no frame: the two doors sit directly
 * on the page, vertically centred, with space doing the grouping that a border
 * would otherwise do.
 *
 * The thesis is that this page is a threshold rather than a destination. A card
 * asks to be looked at; an open column asks to be walked through. On the phone
 * this surface is designed for, a card is also a border drawn a few pixels
 * inside another border, which buys nothing and costs width.
 *
 * Behaviour lives in `useSignIn` — every variant shares it, so what is being
 * judged here is structure rather than wiring.
 */

import { Button } from "@repo/design-system/components/button";
import { Checkbox } from "@repo/design-system/components/checkbox";
import { Field, FieldDescription, FieldLabel } from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { Label } from "@repo/design-system/components/label";
import { useId } from "react";
import {
  EMAIL_DOOR_PRECONDITION,
  EMAIL_LABEL,
  GOOGLE_ACCOUNT_NOTICE,
  GOOGLE_BUTTON,
  RESEND_LINK_BUTTON,
  SEND_LINK_BUTTON,
  SHARED_DEVICE_HELP,
  SHARED_DEVICE_LABEL,
  SIGN_IN_TITLE,
} from "./messages";
import { useSignIn } from "./use-sign-in";

export interface SignInFormProps {
  /**
   * Whether the Google door exists in this environment. Both credentials or
   * neither — a button posting to an unconfigured provider is the dead end this
   * surface must never be, so it is absent instead of broken.
   */
  readonly googleAvailable: boolean;
  /** Where to land afterwards. Validated server-side; never trusted here. */
  readonly returnPath: string;
  /** What Better Auth redirected back with, if anything. */
  readonly error?: string | undefined;
}

export function SignInForm({ googleAvailable, returnPath, error }: SignInFormProps) {
  const machine = useSignIn({ returnPath, error });
  const emailId = useId();
  const sharedDeviceId = useId();
  const helpId = useId();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <h1 className="text-foreground text-2xl leading-8 font-semibold tracking-tight">
        {SIGN_IN_TITLE}
      </h1>

      <FeedbackRegion machine={machine} />

      {googleAvailable ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="h-12 w-full text-base"
            onClick={machine.signInWithGoogle}
            disabled={machine.googlePending}
            aria-busy={machine.googlePending}
          >
            {GOOGLE_BUTTON}
          </Button>
          <p className="text-muted-foreground text-sm leading-5">{GOOGLE_ACCOUNT_NOTICE}</p>
        </div>
      ) : null}

      {googleAvailable ? (
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-sm">o</span>
          <span className="bg-border h-px flex-1" />
        </div>
      ) : null}

      <form action={machine.formAction} className="flex flex-col gap-4">
        <input type="hidden" name="returnPath" value={returnPath} />
        <input type="hidden" name="sharedDevice" value={machine.sharedDevice ? "on" : "off"} />

        <Field>
          <FieldLabel htmlFor={emailId}>{EMAIL_LABEL}</FieldLabel>
          <FieldDescription>{EMAIL_DOOR_PRECONDITION}</FieldDescription>
          <Input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            aria-invalid={machine.state.status === "field_error"}
            className="h-12 text-base"
          />
        </Field>

        <Button
          type="submit"
          variant={googleAvailable ? "secondary" : "default"}
          className="h-12 w-full text-base"
          disabled={machine.emailPending}
          aria-busy={machine.emailPending}
        >
          {machine.awaitingLink ? RESEND_LINK_BUTTON : SEND_LINK_BUTTON}
        </Button>
      </form>

      <div className="border-border flex items-start gap-3 border-t pt-5">
        <Checkbox
          id={sharedDeviceId}
          checked={machine.sharedDevice}
          onCheckedChange={(checked) => machine.setSharedDevice(checked === true)}
          aria-describedby={helpId}
          className="mt-1"
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor={sharedDeviceId} className="text-base font-normal">
            {SHARED_DEVICE_LABEL}
          </Label>
          <p id={helpId} className="text-muted-foreground text-sm leading-5">
            {SHARED_DEVICE_HELP}
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * One region for every outcome, above the doors, so what happened is first in
 * the reading order rather than attached to whichever control produced it.
 *
 * Exported because all three variants place it differently but must say the same
 * thing — the tone, the hint and the focus target are behaviour, not layout.
 */
export function FeedbackRegion({
  machine,
  className,
}: {
  machine: ReturnType<typeof useSignIn>;
  className?: string;
}) {
  // Unpacked rather than reached through `machine` member by member, because
  // `ref={machine.announcementRef}` makes oxlint's `react(refs)` rule treat
  // `machine` itself as a ref object and refuse every sibling read as a ref
  // access during render. The reads are of ordinary state and always were; this
  // separates the one binding that genuinely is a ref from the ones that are not.
  const { announcementRef, feedback } = machine;

  return (
    <div
      ref={announcementRef}
      tabIndex={-1}
      aria-live="polite"
      className={`focus-visible:ring-ring/50 rounded-md outline-none focus-visible:ring-[3px] ${className ?? ""}`}
    >
      {feedback ? (
        <div
          className={
            feedback.tone === "success"
              ? "border-border bg-muted rounded-lg border p-4"
              : "border-destructive/30 bg-destructive/5 rounded-lg border p-4"
          }
        >
          <p className="text-foreground text-base leading-6">{feedback.message}</p>
          {feedback.hint ? (
            <p className="text-muted-foreground mt-2 text-sm leading-5">{feedback.hint}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
